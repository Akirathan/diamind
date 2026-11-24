import type { NavigationHistory } from "@/shared/app-state";
import type { Node } from "@/shared/outline/node";
import type { OutlineStore } from "@/renderer/src/outline/store/store";
import type { OutlineEditing } from "@/renderer/src/outline-view/editing/outline-editing";
import { cursorAfterZoom } from "@/renderer/src/outline-view/zoom/cursor-after-zoom";
import type { LocalRoot } from "@/renderer/src/outline-view/zoom/local-root";
import {
  replaceCurrent,
  restoreHistory,
  step,
  visit,
  type Direction,
} from "@/renderer/src/outline-view/zoom/navigation-history";
import type { RootPlaceholder } from "@/renderer/src/outline-view/zoom/root-placeholder";
import type { ScrollPositions } from "@/renderer/src/outline-view/zoom/scroll-positions";
import type { AppStateStore } from "@/renderer/src/persistence/app-state";

export interface NavigationState {
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly canGoUp: boolean;
}

export interface ZoomDeps {
  store: OutlineStore;
  localRoot: LocalRoot;
  editing: OutlineEditing;
  placeholder: RootPlaceholder;
  scrollPositions: ScrollPositions;
  appState: AppStateStore;
}

/** The saved local root, or the global root if it does not exist any more. */
export function savedRootId(
  store: OutlineStore,
  appState: AppStateStore,
): string {
  const id = appState.get("zoomedNodeId");
  return id !== undefined && store.getNode(id) !== undefined
    ? id
    : store.rootId;
}

/** Changes the local root and keeps the navigation history. Fits `useSyncExternalStore`. */
export class Zoom {
  private history: NavigationHistory;
  private state: NavigationState;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly deps: ZoomDeps) {
    const { store, localRoot, appState } = deps;
    this.history = restoreHistory(
      appState.get("navigationHistory"),
      localRoot.get(),
      this.exists,
    );
    this.state = this.computeState();
    store.subscribe(({ changes }) => {
      if (!this.exists(localRoot.get())) {
        this.leaveDeletedRoot(changes.nodes.before);
      }
      this.updateState();
    });
  }

  readonly getState = (): NavigationState => this.state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  zoomTo(id: string): void {
    if (this.exists(id) && id !== this.deps.localRoot.get()) {
      this.leaveRoot(visit(this.history, id));
    }
  }

  back(): void {
    this.go("back");
  }

  forward(): void {
    this.go("forward");
  }

  /** Zooms to the parent of the local root. */
  up(): void {
    const { store, localRoot } = this.deps;
    const parentId = store.getNode(localRoot.get())?.parentId ?? null;
    if (parentId !== null) {
      this.zoomTo(parentId);
    }
  }

  private readonly exists = (id: string): boolean =>
    this.deps.store.getNode(id) !== undefined;

  private go(direction: Direction): void {
    const next = step(this.history, direction, this.exists);
    if (next !== null) {
      this.leaveRoot(next);
    }
  }

  private leaveRoot(history: NavigationHistory): void {
    const { localRoot, placeholder, scrollPositions } = this.deps;
    const previousRootId = localRoot.get();
    scrollPositions.save();
    this.enterRoot(history);
    placeholder.update();
    this.moveCursor(previousRootId);
    this.updateState();
  }

  private leaveDeletedRoot(before: readonly Node[]): void {
    const { store, localRoot } = this.deps;
    const deletedId = localRoot.get();
    const parents = new Map(before.map((node) => [node.id, node.parentId]));
    let id: string | null = deletedId;
    while (id !== null && !this.exists(id)) {
      id = parents.get(id) ?? null;
    }
    this.enterRoot(replaceCurrent(this.history, id ?? store.rootId));
    this.moveCursor(deletedId);
  }

  private enterRoot(history: NavigationHistory): void {
    const { localRoot, editing, appState } = this.deps;
    const rootId = history.entries[history.index];
    this.history = history;
    editing.history.breakMerge();
    localRoot.set(rootId);
    appState.set("zoomedNodeId", rootId);
    appState.set("navigationHistory", history);
  }

  private moveCursor(previousRootId: string): void {
    const { store, localRoot, editing, scrollPositions } = this.deps;
    const cursor = cursorAfterZoom(
      store,
      localRoot.get(),
      previousRootId,
      editing.focus.cursor,
    );
    if (cursor !== null) {
      const keepScroll = scrollPositions.get() > 0;
      editing.focus.request(cursor, { keepScroll });
    }
  }

  private updateState(): void {
    const next = this.computeState();
    const { canGoBack, canGoForward, canGoUp } = this.state;
    if (
      next.canGoBack === canGoBack &&
      next.canGoForward === canGoForward &&
      next.canGoUp === canGoUp
    ) {
      return;
    }
    this.state = next;
    for (const listener of this.listeners) {
      listener();
    }
  }

  private computeState(): NavigationState {
    const { store, localRoot } = this.deps;
    return {
      canGoBack: step(this.history, "back", this.exists) !== null,
      canGoForward: step(this.history, "forward", this.exists) !== null,
      canGoUp: localRoot.get() !== store.rootId,
    };
  }
}
