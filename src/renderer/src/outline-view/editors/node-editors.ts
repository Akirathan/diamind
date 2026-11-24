import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import { markdownPreview } from "@/renderer/src/markdown/preview";
import {
  cursorAt,
  type NodeCursor,
} from "@/renderer/src/outline/editing/cursor";
import { OutlineError } from "@/renderer/src/outline/model/errors";
import type { OutlineStore } from "@/renderer/src/outline/store/store";
import { editingExtensions } from "@/renderer/src/outline-view/editing/editing-extensions";
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
 * Binds pooled CodeMirror editors to the nodes of the visible rows.
 * Editor changes go to the store; store changes go to the bound editor.
 */
export class NodeEditors {
  private readonly extensions: Extension;
  private readonly pool: Pool<EditorView>;
  private readonly nodeIdByView = new Map<EditorView, string>();
  private readonly viewByNodeId = new Map<string, EditorView>();
  private readonly unsubscribe: () => void;
  private readonly unsubscribeCurrent: () => void;
  /** The node whose focused editor was unmounted in this tick. */
  private unfocusedId: string | null = null;

  constructor(
    private readonly store: OutlineStore,
    private readonly editing: OutlineEditing,
  ) {
    this.extensions = [
      theme,
      EditorView.lineWrapping,
      markdownPreview,
      EditorView.updateListener.of((update) => this.onEditorUpdate(update)),
      EditorView.domEventHandlers({
        focus: (_event, view) => this.onEditorFocus(view),
      }),
      editingExtensions(editing, (view) => this.nodeIdByView.get(view)),
    ];
    this.pool = new Pool(
      () => new EditorView({ state: this.createState("") }),
      (view) => view.destroy(),
      MAX_FREE_EDITORS,
    );
    this.unsubscribe = store.subscribe((event) => {
      for (const id of event.changedIds) {
        this.syncFromStore(id);
      }
    });
    this.unsubscribeCurrent = editing.currentNode.subscribe(() =>
      this.moveFocusToCurrent(),
    );
  }

  get createdCount(): number {
    return this.pool.createdCount;
  }

  mount(nodeId: string, parent: HTMLElement): EditorView {
    const view = this.pool.acquire();
    view.setState(this.createState(this.store.getNode(nodeId)?.text ?? ""));
    this.nodeIdByView.set(view, nodeId);
    this.viewByNodeId.set(nodeId, view);
    parent.appendChild(view.dom);
    const { cursor } = this.editing.focus;
    if (this.unfocusedId === nodeId && cursor?.nodeId === nodeId) {
      this.focus(cursor);
    }
    return view;
  }

  /** Returns the editor, or `null` if the node has none. */
  focus({ nodeId, anchor, head }: NodeCursor): EditorView | null {
    const view = this.viewByNodeId.get(nodeId);
    if (view === undefined) {
      return null;
    }
    const { length } = view.state.doc;
    view.dispatch({
      selection: {
        anchor: Math.min(anchor, length),
        head: Math.min(head, length),
      },
    });
    view.focus();
    return view;
  }

  unmount(nodeId: string, view: EditorView): void {
    if (this.viewByNodeId.get(nodeId) === view) {
      this.viewByNodeId.delete(nodeId);
    }
    this.nodeIdByView.delete(view);
    if (document.activeElement === view.contentDOM) {
      view.contentDOM.blur();
      this.unfocusedId = nodeId;
      queueMicrotask(() => {
        this.unfocusedId = null;
      });
    }
    view.dom.remove();
    this.pool.release(view);
  }

  dispose(): void {
    this.unsubscribe();
    this.unsubscribeCurrent();
    for (const view of this.nodeIdByView.keys()) {
      view.destroy();
    }
    this.nodeIdByView.clear();
    this.viewByNodeId.clear();
    this.pool.clear();
  }

  private createState(doc: string): EditorState {
    return EditorState.create({ doc, extensions: this.extensions });
  }

  private onEditorUpdate(update: ViewUpdate): void {
    if (
      !update.docChanged ||
      update.transactions.some((tr) => tr.annotation(fromStore) === true)
    ) {
      return;
    }
    const nodeId = this.nodeIdByView.get(update.view);
    if (nodeId === undefined) {
      return;
    }
    try {
      this.store.setText(nodeId, update.state.doc.toString());
    } catch (error) {
      if (!(error instanceof OutlineError)) {
        throw error;
      }
      this.syncFromStore(nodeId);
    }
  }

  private onEditorFocus(view: EditorView): void {
    const nodeId = this.nodeIdByView.get(view);
    if (nodeId !== undefined) {
      this.editing.currentNode.set(nodeId);
    }
  }

  /** The cursor moves out of a subtree that collapses. */
  private moveFocusToCurrent(): void {
    const { currentNode, focus } = this.editing;
    const currentId = currentNode.get();
    const focused = [...this.nodeIdByView].find(([view]) => view.hasFocus);
    if (
      currentId === null ||
      focused === undefined ||
      focused[1] === currentId ||
      focus.cursor !== null
    ) {
      return;
    }
    const length = this.store.getNode(currentId)?.text.length ?? 0;
    focus.request(cursorAt(currentId, length));
  }

  /** A minimal replacement keeps the cursor of a focused editor in place. */
  private syncFromStore(nodeId: string): void {
    const view = this.viewByNodeId.get(nodeId);
    const node = this.store.getNode(nodeId);
    if (view === undefined || node === undefined) {
      return;
    }
    const change = textChange(view.state.doc.toString(), node.text);
    if (change !== null) {
      view.dispatch({ changes: change, annotations: fromStore.of(true) });
    }
  }
}
