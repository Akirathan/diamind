import { parseOutlineJson, type DiamindApi } from "@/shared/api";
import type { OutlineRows } from "@/renderer/src/outline/model/load";
import { seedRows } from "@/renderer/src/outline/fixtures/seed";
import { OutlineStore } from "@/renderer/src/outline/store/store";
import type { CurrentNode } from "@/renderer/src/outline-view/focus/current-node";
import { OutlineRowsSource } from "@/renderer/src/outline-view/rows/flatten";
import { CurrentIndentLine } from "@/renderer/src/outline-view/rows/indent-lines";
import { NodeEditors } from "@/renderer/src/outline-view/editors/node-editors";
import { OutlineEditing } from "@/renderer/src/outline-view/editing/outline-editing";
import { saveOutline } from "@/renderer/src/persistence/save-outline";

/** The store and the view state built on it. Lives as long as the window. */
export interface OutlineSession {
  store: OutlineStore;
  rows: OutlineRowsSource;
  editing: OutlineEditing;
  currentNode: CurrentNode;
  currentIndentLine: CurrentIndentLine;
  editors: NodeEditors;
  stopSaving: () => void;
}

export interface StartupOutline {
  rows: OutlineRows;
  /** True for generated nodes. They are never saved. */
  seeded: boolean;
}

export async function loadStartupOutline(
  api: DiamindApi,
): Promise<StartupOutline> {
  const { devSeedNodeCount } = await api.getAppInfo();
  if (devSeedNodeCount > 0) {
    return { rows: { nodes: seedRows(devSeedNodeCount) }, seeded: true };
  }
  const json = await api.loadOutline();
  return { rows: parseOutlineJson(json), seeded: false };
}

export function createOutlineSession(
  startup: StartupOutline,
  api: DiamindApi,
): OutlineSession {
  const { store, changes } = OutlineStore.load(startup.rows);
  // Subscribes before the views, so an error in a view cannot skip a save.
  const stopSaving = startup.seeded
    ? () => {}
    : saveOutline(store, changes, api);
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
    stopSaving,
  };
}

/** Workflowy behavior: an outline without a visible node gets one empty node to type into. */
export function ensureVisibleNode(store: OutlineStore, rootId: string): void {
  if (store.getChildren(rootId).length === 0) {
    store.insertNode(rootId, null);
  }
}
