import { seedRows } from "@/renderer/src/outline/seed";
import { OutlineStore } from "@/renderer/src/outline/store";
import { OutlineRowsSource } from "@/renderer/src/outline-view/flatten";
import { OutlineEditing } from "@/renderer/src/outline-view/outline-editing";
import { NodeEditors } from "@/renderer/src/outline-view/node-editors";

/** The store and the view state built on it. Lives as long as the window. */
export interface OutlineSession {
  store: OutlineStore;
  rows: OutlineRowsSource;
  editing: OutlineEditing;
  editors: NodeEditors;
}

export function createOutlineSession(seedNodeCount: number): OutlineSession {
  const nodes = seedNodeCount > 0 ? seedRows(seedNodeCount) : [];
  const { store } = OutlineStore.load({ nodes });
  const editing = new OutlineEditing(store, store.rootId);
  return {
    store,
    rows: new OutlineRowsSource(store, store.rootId),
    editing,
    editors: new NodeEditors(store, editing),
  };
}

/** Workflowy behavior: an outline without a visible node gets one empty node to type into. */
export function ensureVisibleNode(store: OutlineStore, rootId: string): void {
  if (store.getChildren(rootId).length === 0) {
    store.insertNode(rootId, null);
  }
}
