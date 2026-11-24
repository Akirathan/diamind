import type { AppStateValues } from "@/shared/app-state";
import { parseOutlineJson, type DiamindApi } from "@/shared/api";
import type { OutlineRows } from "@/renderer/src/outline/model/load";
import { seedRows } from "@/renderer/src/outline/fixtures/seed";
import { OutlineStore } from "@/renderer/src/outline/store/store";
import type { CurrentNode } from "@/renderer/src/outline-view/focus/current-node";
import { OutlineRowsSource } from "@/renderer/src/outline-view/rows/flatten";
import { CurrentIndentLine } from "@/renderer/src/outline-view/rows/indent-lines";
import { NodeEditors } from "@/renderer/src/outline-view/editors/node-editors";
import { OutlineEditing } from "@/renderer/src/outline-view/editing/outline-editing";
import { LocalRoot } from "@/renderer/src/outline-view/zoom/local-root";
import { RootPlaceholder } from "@/renderer/src/outline-view/zoom/root-placeholder";
import { ScrollPositions } from "@/renderer/src/outline-view/zoom/scroll-positions";
import { savedRootId, Zoom } from "@/renderer/src/outline-view/zoom/zoom";
import { AppStateStore } from "@/renderer/src/persistence/app-state";
import { saveOutline } from "@/renderer/src/persistence/save-outline";

/** The store and the view state built on it. Lives as long as the window. */
export interface OutlineSession {
  store: OutlineStore;
  appState: AppStateStore;
  localRoot: LocalRoot;
  zoom: Zoom;
  scrollPositions: ScrollPositions;
  rows: OutlineRowsSource;
  editing: OutlineEditing;
  currentNode: CurrentNode;
  currentIndentLine: CurrentIndentLine;
  editors: NodeEditors;
  stopSaving: () => void;
}

export interface StartupOutline {
  rows: OutlineRows;
  appState: AppStateValues;
  /** True for generated nodes. Nothing of the session is saved. */
  seeded: boolean;
}

export async function loadStartupOutline(
  api: DiamindApi,
): Promise<StartupOutline> {
  const { devSeedNodeCount } = await api.getAppInfo();
  if (devSeedNodeCount > 0) {
    return {
      rows: { nodes: seedRows(devSeedNodeCount) },
      appState: {},
      seeded: true,
    };
  }
  const [json, appState] = await Promise.all([
    api.loadOutline(),
    loadAppState(api),
  ]);
  return { rows: parseOutlineJson(json), appState, seeded: false };
}

async function loadAppState(api: DiamindApi): Promise<AppStateValues> {
  try {
    return await api.loadAppState();
  } catch (error) {
    console.error("Loading the app state failed", error);
    return {};
  }
}

export function createOutlineSession(
  startup: StartupOutline,
  api: DiamindApi,
): OutlineSession {
  const { store, changes } = OutlineStore.load(startup.rows);
  const appState = new AppStateStore(startup.appState);
  // Subscribes before the views, so an error in a view cannot skip a save.
  const stopSaving = startup.seeded
    ? () => {}
    : saveOutline(store, appState, changes, api);
  const localRoot = new LocalRoot(savedRootId(store, appState));
  const rows = new OutlineRowsSource(store, localRoot);
  const editing = new OutlineEditing(store, localRoot);
  const { currentNode } = editing;
  const scrollPositions = new ScrollPositions(
    store,
    localRoot,
    editing.history,
  );
  const placeholder = new RootPlaceholder(store, localRoot, editing);
  const zoom = new Zoom({
    store,
    localRoot,
    editing,
    placeholder,
    scrollPositions,
    appState,
  });
  return {
    store,
    appState,
    localRoot,
    zoom,
    scrollPositions,
    rows,
    editing,
    currentNode,
    currentIndentLine: new CurrentIndentLine(store, currentNode, rows),
    editors: new NodeEditors(store, editing),
    stopSaving,
  };
}
