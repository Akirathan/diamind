import {
  EditorSelection,
  EditorState,
  type Extension,
} from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import { markdownPreview } from "@/renderer/src/markdown/preview";
import {
  cursorAt,
  isSameField,
  type FieldRef,
  type NodeCursor,
  type NodeField,
} from "@/renderer/src/outline/editing/cursor";
import type { CursorTarget } from "@/renderer/src/outline/editing/cursor-moves";
import { OutlineError } from "@/renderer/src/outline/model/errors";
import type { OutlineStore } from "@/renderer/src/outline/store/store";
import { editingExtensions } from "@/renderer/src/outline-view/editing/editing-extensions";
import { cursorOf } from "@/renderer/src/outline-view/editing/editor-cursor";
import { fromStore } from "@/renderer/src/outline-view/editors/from-store";
import type { OutlineEditing } from "@/renderer/src/outline-view/editing/outline-editing";
import { Pool } from "@/renderer/src/outline-view/editors/pool";
import { textChange } from "@/renderer/src/outline-view/editors/text-change";

const MAX_FREE_EDITORS = 50;

const theme = EditorView.theme({
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "inherit", lineHeight: "inherit" },
  ".cm-content": { padding: "0" },
  ".cm-line": { padding: "0" },
  "@media (prefers-color-scheme: dark)": {
    ".cm-content": { caretColor: "white" },
  },
});

/**
 * Binds pooled CodeMirror editors to the texts and notes of the visible rows.
 * Editor changes go to the store; store changes go to the bound editor.
 */
export class NodeEditors {
  private readonly extensions: Record<NodeField, Extension>;
  private readonly pool: Pool<EditorView>;
  private readonly fieldByView = new Map<EditorView, FieldRef>();
  private readonly viewByNodeId: Record<NodeField, Map<string, EditorView>> = {
    text: new Map(),
    note: new Map(),
  };
  private readonly unsubscribe: () => void;
  private readonly unsubscribeCurrent: () => void;
  /** The field whose focused editor was unmounted in this tick. */
  private unfocused: FieldRef | null = null;

  constructor(
    private readonly store: OutlineStore,
    private readonly editing: OutlineEditing,
  ) {
    this.extensions = {
      text: this.createExtensions("text"),
      note: this.createExtensions("note"),
    };
    this.pool = new Pool(
      () => new EditorView(),
      (view) => view.destroy(),
      MAX_FREE_EDITORS,
    );
    this.unsubscribe = store.subscribe((event) => {
      for (const id of event.changedIds) {
        this.syncFromStore({ nodeId: id, field: "text" });
        this.syncFromStore({ nodeId: id, field: "note" });
      }
    });
    this.unsubscribeCurrent = editing.currentNode.subscribe(() =>
      this.moveFocusToCurrent(),
    );
  }

  get createdCount(): number {
    return this.pool.createdCount;
  }

  mount(ref: FieldRef, parent: HTMLElement): EditorView {
    const { nodeId, field } = ref;
    const view = this.pool.acquire();
    view.setState(
      EditorState.create({
        doc: this.store.getNode(nodeId)?.[field] ?? "",
        extensions: this.extensions[field],
      }),
    );
    this.fieldByView.set(view, ref);
    this.viewByNodeId[field].set(nodeId, view);
    parent.appendChild(view.dom);
    const { cursor } = this.editing.focus;
    if (
      this.unfocused !== null &&
      cursor !== null &&
      isSameField(this.unfocused, ref) &&
      isSameField(cursor, ref)
    ) {
      this.focus(cursor);
    }
    return view;
  }

  /** Returns the editor, or `null` if the field has none. */
  focus(target: CursorTarget): EditorView | null {
    const view = this.viewByNodeId[target.field].get(target.nodeId);
    if (view === undefined) {
      return null;
    }
    if (target.toLineStart === true) {
      view.dispatch({
        selection: lineStart(view, target),
        // Keeps the cursor out of hidden markdown markers.
        userEvent: "select",
      });
    } else {
      view.dispatch({ selection: clamped(view, target) });
    }
    view.focus();
    return view;
  }

  unmount({ nodeId, field }: FieldRef, view: EditorView): void {
    if (this.viewByNodeId[field].get(nodeId) === view) {
      this.viewByNodeId[field].delete(nodeId);
    }
    this.fieldByView.delete(view);
    if (document.activeElement === view.contentDOM) {
      view.contentDOM.blur();
      this.unfocused = { nodeId, field };
      queueMicrotask(() => {
        this.unfocused = null;
      });
    }
    view.dom.remove();
    this.pool.release(view);
  }

  dispose(): void {
    this.unsubscribe();
    this.unsubscribeCurrent();
    for (const view of this.fieldByView.keys()) {
      view.destroy();
    }
    this.fieldByView.clear();
    this.viewByNodeId.text.clear();
    this.viewByNodeId.note.clear();
    this.pool.clear();
  }

  private createExtensions(field: NodeField): Extension {
    return [
      theme,
      EditorView.lineWrapping,
      markdownPreview,
      EditorView.updateListener.of((update) => this.onEditorUpdate(update)),
      EditorView.domEventHandlers({
        focus: (_event, view) => this.onEditorFocus(view),
        blur: (_event, view) => this.onEditorBlur(view),
      }),
      editingExtensions(this.editing, field, (view) =>
        this.fieldByView.get(view),
      ),
    ];
  }

  private onEditorUpdate(update: ViewUpdate): void {
    if (
      !update.docChanged ||
      update.transactions.some((tr) => tr.annotation(fromStore) === true)
    ) {
      return;
    }
    const ref = this.fieldByView.get(update.view);
    if (ref === undefined) {
      return;
    }
    const content = update.state.doc.toString();
    try {
      if (ref.field === "text") {
        this.store.setText(ref.nodeId, content);
      } else {
        this.store.setNote(ref.nodeId, content);
      }
    } catch (error) {
      if (!(error instanceof OutlineError)) {
        throw error;
      }
      this.syncFromStore(ref);
    }
  }

  private onEditorFocus(view: EditorView): void {
    const cursor = cursorOf(view, (v) => this.fieldByView.get(v));
    if (cursor !== null) {
      this.editing.currentNode.set(cursor.nodeId);
      this.editing.focus.setCursor(cursor);
    }
  }

  private onEditorBlur(view: EditorView): void {
    const ref = this.fieldByView.get(view);
    if (ref === undefined) {
      return;
    }
    // A moved row gets the focus back. A window without focus gets it back later.
    setTimeout(() => {
      const current = this.viewByNodeId[ref.field].get(ref.nodeId);
      const isFocused = document.activeElement === current?.contentDOM;
      if (!isFocused && document.hasFocus()) {
        this.editing.closeEmptyNote(ref);
      }
    });
  }

  /** The cursor moves out of a subtree that collapses. */
  private moveFocusToCurrent(): void {
    const { currentNode, focus } = this.editing;
    const currentId = currentNode.get();
    const focused = [...this.fieldByView].find(([view]) => view.hasFocus);
    if (
      currentId === null ||
      focused === undefined ||
      focused[1].nodeId === currentId ||
      focus.cursor !== null
    ) {
      return;
    }
    const length = this.store.getNode(currentId)?.text.length ?? 0;
    focus.request(cursorAt(currentId, length));
  }

  /** A minimal replacement keeps the cursor of a focused editor in place. */
  private syncFromStore({ nodeId, field }: FieldRef): void {
    const view = this.viewByNodeId[field].get(nodeId);
    const node = this.store.getNode(nodeId);
    if (view === undefined || node === undefined) {
      return;
    }
    const change = textChange(view.state.doc.toString(), node[field]);
    if (change !== null) {
      view.dispatch({ changes: change, annotations: fromStore.of(true) });
    }
  }
}

function clamped(view: EditorView, { anchor, head }: NodeCursor) {
  const { length } = view.state.doc;
  return { anchor: Math.min(anchor, length), head: Math.min(head, length) };
}

function lineStart(view: EditorView, cursor: NodeCursor) {
  const { head } = clamped(view, cursor);
  const start = EditorSelection.cursor(head, -1);
  return { anchor: view.moveToLineBoundary(start, false).head };
}
