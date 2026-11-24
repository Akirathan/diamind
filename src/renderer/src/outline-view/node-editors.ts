import { Annotation, EditorState, type Extension } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import { markdownPreview } from "@/renderer/src/markdown/preview";
import type { OutlineStore } from "@/renderer/src/outline/store";
import { Pool } from "@/renderer/src/outline-view/pool";
import { textChange } from "@/renderer/src/outline-view/text-change";

const MAX_FREE_EDITORS = 50;

/** Marks a transaction that copies a store change into the editor. */
const fromStore = Annotation.define<boolean>();

const theme = EditorView.theme({
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { lineHeight: "inherit" },
  ".cm-content": { padding: "0" },
  ".cm-line": { padding: "0" },
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

  constructor(private readonly store: OutlineStore) {
    this.extensions = [
      theme,
      EditorView.lineWrapping,
      markdownPreview,
      EditorView.updateListener.of((update) => this.onEditorUpdate(update)),
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
    return view;
  }

  unmount(nodeId: string, view: EditorView): void {
    if (this.viewByNodeId.get(nodeId) === view) {
      this.viewByNodeId.delete(nodeId);
    }
    this.nodeIdByView.delete(view);
    if (view.hasFocus) {
      view.contentDOM.blur();
    }
    view.dom.remove();
    this.pool.release(view);
  }

  dispose(): void {
    this.unsubscribe();
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
    if (nodeId !== undefined) {
      this.store.setText(nodeId, update.state.doc.toString());
    }
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
