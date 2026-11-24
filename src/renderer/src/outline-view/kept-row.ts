import { defaultRangeExtractor, type Range } from "@tanstack/react-virtual";
import type { CurrentNode } from "@/renderer/src/outline-view/current-node";
import type { OutlineRow } from "@/renderer/src/outline-view/flatten";

/** Adds an index to ascending contiguous indexes, if it is not -1. */
export function withIndex(indexes: number[], index: number): number[] {
  if (index < 0 || indexes.length === 0) {
    return indexes;
  }
  if (index < indexes[0]) {
    return [index, ...indexes];
  }
  if (index > indexes[indexes.length - 1]) {
    return [...indexes, index];
  }
  return indexes;
}

/** Renders the visible rows and the row of the current node. */
export function keepCurrentRow(
  rows: readonly Pick<OutlineRow, "id">[],
  currentNode: CurrentNode,
): (range: Range) => number[] {
  let nodeId: string | null = null;
  let index = -1;
  return (range) => {
    const currentId = currentNode.get();
    if (currentId !== nodeId) {
      nodeId = currentId;
      index = rows.findIndex((row) => row.id === nodeId);
    }
    return withIndex(defaultRangeExtractor(range), index);
  };
}
