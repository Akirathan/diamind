import type { OutlineEvent, OutlineStore } from "@/renderer/src/outline/store";

/**
 * The node with the cursor. It stays current when the focus leaves the outline,
 * e.g. to a button or to another window. Fits `useSyncExternalStore`.
 */
export class CurrentNode {
  private id: string | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: () => void;

  constructor(private readonly store: OutlineStore) {
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
    const collapsedIds = new Set(
      changes.uiState.upsert
        .filter((state) => state.collapsed)
        .map((state) => state.nodeId),
    );
    if (collapsedIds.size > 0) {
      this.set(topmostAncestor(this.store, this.id, collapsedIds) ?? this.id);
    }
  }
}

/** The topmost ancestor of `id` that is in `candidates`. */
function topmostAncestor(
  store: OutlineStore,
  id: string,
  candidates: ReadonlySet<string>,
): string | null {
  let result: string | null = null;
  let ancestor = store.getNode(id)?.parentId ?? null;
  while (ancestor !== null) {
    if (candidates.has(ancestor)) {
      result = ancestor;
    }
    ancestor = store.getNode(ancestor)?.parentId ?? null;
  }
  return result;
}
