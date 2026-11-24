import type { AppStateValues } from "@/shared/app-state";
import {
  cursorAt,
  type NodeCursor,
} from "@/renderer/src/outline/editing/cursor";
import type { OutlineStore } from "@/renderer/src/outline/store/store";
import { OutlineEditing } from "@/renderer/src/outline-view/editing/outline-editing";
import { LocalRoot } from "@/renderer/src/outline-view/zoom/local-root";
import { RootPlaceholder } from "@/renderer/src/outline-view/zoom/root-placeholder";
import { ScrollPositions } from "@/renderer/src/outline-view/zoom/scroll-positions";
import { savedRootId, Zoom } from "@/renderer/src/outline-view/zoom/zoom";
import { AppStateStore } from "@/renderer/src/persistence/app-state";

/** The zoom of a session, without views. */
export function createZoom(store: OutlineStore, saved: AppStateValues = {}) {
  const appState = new AppStateStore(saved);
  const localRoot = new LocalRoot(savedRootId(store, appState));
  const editing = new OutlineEditing(store, localRoot);
  const { history, focus } = editing;
  const scrollPositions = new ScrollPositions(store, localRoot, history);
  const placeholder = new RootPlaceholder(store, localRoot, editing);
  const zoom = new Zoom({
    store,
    localRoot,
    editing,
    placeholder,
    scrollPositions,
    appState,
  });

  function putCursor(nodeId: string, offset = 0): void {
    const cursor: NodeCursor = cursorAt(nodeId, offset);
    editing.currentNode.set(nodeId);
    focus.setCursor(cursor);
  }

  return {
    appState,
    localRoot,
    editing,
    history,
    focus,
    scrollPositions,
    zoom,
    putCursor,
  };
}

/** Lets the delayed updates run. */
export function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}
