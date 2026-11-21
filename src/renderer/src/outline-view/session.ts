import { seedRows } from "../outline/seed";
import { OutlineStore } from "../outline/store";
import { OutlineRowsSource } from "./flatten";
import { NodeEditors } from "./node-editors";

/** The store and the view state built on it. Lives as long as the window. */
export interface OutlineSession {
  store: OutlineStore;
  rows: OutlineRowsSource;
  editors: NodeEditors;
}

export function createOutlineSession(seedNodeCount: number): OutlineSession {
  const nodes = seedNodeCount > 0 ? seedRows(seedNodeCount) : [];
  const { store } = OutlineStore.load({ nodes });
  return {
    store,
    rows: new OutlineRowsSource(store, store.rootId),
    editors: new NodeEditors(store),
  };
}

/** Workflowy behavior: an outline without a visible node gets one empty node to type into. */
export function ensureVisibleNode(store: OutlineStore, rootId: string): void {
  if (store.getChildren(rootId).length === 0) {
    store.insertNode(rootId, null);
  }
}
