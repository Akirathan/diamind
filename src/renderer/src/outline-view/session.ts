import { parseOutlineJson, type DiamindApi } from "@/shared/api";
import type { OutlineRows } from "@/renderer/src/outline/load";
import { seedRows } from "@/renderer/src/outline/seed";
import { OutlineStore } from "@/renderer/src/outline/store";
import { OutlineRowsSource } from "@/renderer/src/outline-view/flatten";
import { NodeEditors } from "@/renderer/src/outline-view/node-editors";
import { saveOutline } from "@/renderer/src/persistence/save-outline";

/** The store and the view state built on it. Lives as long as the window. */
export interface OutlineSession {
  store: OutlineStore;
  rows: OutlineRowsSource;
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
  { rows, seeded }: StartupOutline,
  api: DiamindApi,
): OutlineSession {
  const { store, changes } = OutlineStore.load(rows);
  // Subscribes before the views, so an error in a view cannot skip a save.
  const stopSaving = seeded ? () => {} : saveOutline(store, changes, api);
  return {
    store,
    rows: new OutlineRowsSource(store, store.rootId),
    editors: new NodeEditors(store),
    stopSaving,
  };
}

/** Workflowy behavior: an outline without a visible node gets one empty node to type into. */
export function ensureVisibleNode(store: OutlineStore, rootId: string): void {
  if (store.getChildren(rootId).length === 0) {
    store.insertNode(rootId, null);
  }
}
