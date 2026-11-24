import type { ChangeSet } from "@/shared/outline/change-set";
import type {
  OutlineEvent,
  OutlineStore,
} from "@/renderer/src/outline/store/store";
import type { LocalRoot } from "@/renderer/src/outline-view/zoom/local-root";

/**
 * The node with the cursor. It stays current when the focus leaves the outline,
 * e.g. to a button or to another window. Fits `useSyncExternalStore`.
 */
export class CurrentNode {
  private id: string | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: () => void;

  constructor(
    private readonly store: OutlineStore,
    private readonly localRoot?: LocalRoot,
  ) {
    this.unsubscribe = store.subscribe((event) => this.onStoreChange(event));
  }

  readonly get = (): string | null => this.id;

  set(id: string | null): void {
    if (id === this.id) {
      return;
    }
    this.id = id;
    for (const listener of this.listeners) {
      listener();
    }
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  dispose(): void {
    this.unsubscribe();
    this.listeners.clear();
  }

  private onStoreChange({ changes }: OutlineEvent): void {
    if (this.id === null) {
      return;
    }
    if (this.store.getNode(this.id) === undefined) {
      this.set(null);
      return;
    }
    const collapsedIds = newlyCollapsed(changes);
    if (collapsedIds.size > 0) {
      const rootId = this.localRoot?.get() ?? this.store.rootId;
      this.set(
        topmostAncestor(this.store, rootId, this.id, collapsedIds) ?? this.id,
      );
    }
  }
}

function newlyCollapsed({ uiState }: ChangeSet): Set<string> {
  const before = new Map(uiState.before.map((state) => [state.nodeId, state]));
  const ids = new Set<string>();
  for (const { nodeId, collapsed } of uiState.upsert) {
    if (collapsed && before.get(nodeId)?.collapsed !== true) {
      ids.add(nodeId);
    }
  }
  return ids;
}

/** The topmost ancestor of `id` below `rootId` that is in `candidates`. */
function topmostAncestor(
  store: OutlineStore,
  rootId: string,
  id: string,
  candidates: ReadonlySet<string>,
): string | null {
  let result: string | null = null;
  if (id === rootId) {
    return null;
  }
  let ancestor = store.getNode(id)?.parentId ?? null;
  while (ancestor !== null && ancestor !== rootId) {
    if (candidates.has(ancestor)) {
      result = ancestor;
    }
    ancestor = store.getNode(ancestor)?.parentId ?? null;
  }
  return result;
}
