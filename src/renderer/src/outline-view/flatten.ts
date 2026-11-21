import type { ChangeSet } from "../../../shared/outline/change-set";
import type { OutlineStore } from "../outline/store";

export interface OutlineRow {
  readonly id: string;
  /** 0 for the children of the local root. */
  readonly depth: number;
}

/** The visible descendants of `rootId` in document order. Children of collapsed nodes are skipped. */
export function flattenVisible(
  store: OutlineStore,
  rootId: string,
): OutlineRow[] {
  const rows: OutlineRow[] = [];
  const stack: OutlineRow[] = [];
  pushChildren(store, rootId, 0, stack);
  while (stack.length > 0) {
    const row = stack.pop() as OutlineRow;
    rows.push(row);
    if (store.getUiState(row.id)?.collapsed !== true) {
      pushChildren(store, row.id, row.depth + 1, stack);
    }
  }
  return rows;
}

function pushChildren(
  store: OutlineStore,
  parentId: string,
  depth: number,
  stack: OutlineRow[],
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
 * Fits `useSyncExternalStore`.
 */
export class OutlineRowsSource {
  private rows: OutlineRow[];
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: () => void;

  constructor(
    private readonly store: OutlineStore,
    private readonly rootId: string,
  ) {
    this.rows = flattenVisible(store, rootId);
    this.unsubscribe = store.subscribe((event) => {
      if (!changesRows(event.changes)) {
        return;
      }
      this.rows = flattenVisible(this.store, this.rootId);
      for (const listener of this.listeners) {
        listener();
      }
    });
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getRows = (): readonly OutlineRow[] => this.rows;

  dispose(): void {
    this.unsubscribe();
    this.listeners.clear();
  }
}
