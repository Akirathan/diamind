import { defaultRangeExtractor, type Range } from "@tanstack/react-virtual";
import type { OutlineRow } from "@/renderer/src/outline-view/flatten";
import type { NodeFocus } from "@/renderer/src/outline-view/node-focus";

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

/** Renders the visible rows and the row with the cursor. */
export function keepCursorRow(
  rows: readonly OutlineRow[],
  focus: NodeFocus,
): (range: Range) => number[] {
  let nodeId: string | null = null;
  let index = -1;
  return (range) => {
    const cursorNodeId = focus.cursor?.nodeId ?? null;
    if (cursorNodeId !== nodeId) {
      nodeId = cursorNodeId;
      index = rows.findIndex((row) => row.id === nodeId);
    }
    return withIndex(defaultRangeExtractor(range), index);
  };
}
