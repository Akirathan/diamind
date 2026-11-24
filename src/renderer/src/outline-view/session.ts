import { seedRows } from "@/renderer/src/outline/seed";
import { OutlineStore } from "@/renderer/src/outline/store";
import type { CurrentNode } from "@/renderer/src/outline-view/current-node";
import { OutlineRowsSource } from "@/renderer/src/outline-view/flatten";
import { CurrentIndentLine } from "@/renderer/src/outline-view/indent-lines";
import { NodeEditors } from "@/renderer/src/outline-view/node-editors";
import { OutlineEditing } from "@/renderer/src/outline-view/outline-editing";

/** The store and the view state built on it. Lives as long as the window. */
export interface OutlineSession {
  store: OutlineStore;
  rows: OutlineRowsSource;
  editing: OutlineEditing;
  currentNode: CurrentNode;
  currentIndentLine: CurrentIndentLine;
  editors: NodeEditors;
}

export function createOutlineSession(seedNodeCount: number): OutlineSession {
  const nodes = seedNodeCount > 0 ? seedRows(seedNodeCount) : [];
  const { store } = OutlineStore.load({ nodes });
  const rows = new OutlineRowsSource(store, store.rootId);
  const editing = new OutlineEditing(store, store.rootId);
  const { currentNode } = editing;
  return {
    store,
    rows,
    editing,
    currentNode,
    currentIndentLine: new CurrentIndentLine(store, currentNode, rows),
    editors: new NodeEditors(store, editing),
  };
}

/** Workflowy behavior: an outline without a visible node gets one empty node to type into. */
export function ensureVisibleNode(store: OutlineStore, rootId: string): void {
  if (store.getChildren(rootId).length === 0) {
    store.insertNode(rootId, null);
  }
}
