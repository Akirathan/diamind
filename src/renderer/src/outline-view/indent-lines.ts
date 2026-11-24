import type { OutlineStore } from "@/renderer/src/outline/store";
import type { CurrentNode } from "@/renderer/src/outline-view/current-node";
import type { OutlineRowsSource } from "@/renderer/src/outline-view/flatten";

/** The part of an indent line that lies in one row. */
export interface IndentLineSegment {
  /** Depth of the ancestor that the line belongs to. */
  readonly level: number;
  readonly current: boolean;
}

/** One segment for each visible ancestor of a row of the given depth. */
export function indentLineSegments(
  depth: number,
  currentLevel: number | null,
): IndentLineSegment[] {
  return Array.from({ length: depth }, (_, level) => ({
    level,
    current: level === currentLevel,
  }));
}

/**
 * The depth of `ownerId` if its indent line passes through the row, else `null`.
 * The local root has no indent line.
 */
export function levelOfOwner(
  store: OutlineStore,
  rowId: string,
  depth: number,
  ownerId: string | null,
): number | null {
  if (ownerId === null) {
    return null;
  }
  let id = store.getNode(rowId)?.parentId ?? null;
  for (let level = depth - 1; level >= 0 && id !== null; level--) {
    if (id === ownerId) {
      return level;
    }
    id = store.getNode(id)?.parentId ?? null;
  }
  return null;
}

/** The indent line of the parent of the current node. */
export class CurrentIndentLine {
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribes: (() => void)[];

  constructor(
    private readonly store: OutlineStore,
    private readonly currentNode: CurrentNode,
    rows: OutlineRowsSource,
  ) {
    this.unsubscribes = [
      currentNode.subscribe(() => this.notify()),
      rows.subscribe(() => this.notify()),
    ];
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** The level of the current indent line in a row, `null` if it does not pass through it. */
  levelInRow(rowId: string, depth: number): number | null {
    const currentId = this.currentNode.get();
    if (currentId === null) {
      return null;
    }
    const ownerId = this.store.getNode(currentId)?.parentId ?? null;
    return levelOfOwner(this.store, rowId, depth, ownerId);
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribes) {
      unsubscribe();
    }
    this.listeners.clear();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
