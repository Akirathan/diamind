import type { ChangeSet } from "@/shared/outline/change-set";
import type { OutlineStore } from "@/renderer/src/outline/store/store";

export interface OutlineRow {
  readonly id: string;
  /** 0 for the children of the local root. */
  readonly depth: number;
  readonly hasChildren: boolean;
  /** Always false for a row without children. */
  readonly collapsed: boolean;
}

interface PendingRow {
  id: string;
  depth: number;
}

/** The visible descendants of `rootId` in document order. Children of collapsed nodes are skipped. */
export function flattenVisible(
  store: OutlineStore,
  rootId: string,
): OutlineRow[] {
  const rows: OutlineRow[] = [];
  const stack: PendingRow[] = [];
  pushChildren(store, rootId, 0, stack);
  while (stack.length > 0) {
    const { id, depth } = stack.pop() as PendingRow;
    const hasChildren = store.getChildren(id).length > 0;
    const collapsed = hasChildren && store.getUiState(id)?.collapsed === true;
    rows.push({ id, depth, hasChildren, collapsed });
    if (!collapsed) {
      pushChildren(store, id, depth + 1, stack);
    }
  }
  return rows;
}

function pushChildren(
  store: OutlineStore,
  parentId: string,
  depth: number,
  stack: PendingRow[],
): void {
  const children = store.getChildren(parentId);
  for (let i = children.length - 1; i >= 0; i--) {
    stack.push({ id: children[i], depth });
  }
}

/** True if the change can change the visible rows, not only the content of a row. */
export function changesRows(changes: ChangeSet): boolean {
  if (
    changes.nodes.delete.length > 0 ||
    changes.uiState.upsert.length > 0 ||
    changes.uiState.delete.length > 0
  ) {
    return true;
  }
  const before = new Map(changes.nodes.before.map((node) => [node.id, node]));
  return changes.nodes.upsert.some((node) => {
    const prev = before.get(node.id);
    return (
      prev === undefined ||
      prev.parentId !== node.parentId ||
      prev.sortKey !== node.sortKey
    );
  });
}

/**
 * The visible rows of an outline, recomputed only when the structure changes.
 * Several changes in one tick cause one notification. Fits `useSyncExternalStore`.
 */
export class OutlineRowsSource {
  private rows: OutlineRow[];
  private stale = false;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: () => void;

  constructor(
    private readonly store: OutlineStore,
    private readonly rootId: string,
  ) {
    this.rows = flattenVisible(store, rootId);
    this.unsubscribe = store.subscribe((event) => {
      if (!this.stale && changesRows(event.changes)) {
        this.stale = true;
        queueMicrotask(() => this.notify());
      }
    });
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getRows = (): readonly OutlineRow[] => {
    if (this.stale) {
      this.stale = false;
      this.rows = flattenVisible(this.store, this.rootId);
    }
    return this.rows;
  };

  dispose(): void {
    this.unsubscribe();
    this.listeners.clear();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
