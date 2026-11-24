import { describe, expect, it } from "vitest";
import { cursorAt } from "@/renderer/src/outline/cursor";
import { keepCursorRow, withIndex } from "@/renderer/src/outline-view/kept-row";
import { NodeFocus } from "@/renderer/src/outline-view/node-focus";

describe("withIndex", () => {
  it("keeps the indexes ascending", () => {
    expect(withIndex([3, 4, 5], 1)).toEqual([1, 3, 4, 5]);
    expect(withIndex([3, 4, 5], 9)).toEqual([3, 4, 5, 9]);
  });

  it("does not add a present or missing index", () => {
    expect(withIndex([3, 4, 5], 4)).toEqual([3, 4, 5]);
    expect(withIndex([3, 4, 5], -1)).toEqual([3, 4, 5]);
    expect(withIndex([], 2)).toEqual([]);
  });
});

describe("keepCursorRow", () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({
    id: `n${i}`,
    depth: 0,
  }));
  const range = { startIndex: 10, endIndex: 11, overscan: 1, count: 20 };

  it("adds the row with the cursor", () => {
    const focus = new NodeFocus();
    const extract = keepCursorRow(rows, focus);
    expect(extract(range)).toEqual([9, 10, 11, 12]);
    focus.setCursor(cursorAt("n2", 0));
    expect(extract(range)).toEqual([2, 9, 10, 11, 12]);
    focus.request(cursorAt("n19", 0));
    expect(extract(range)).toEqual([9, 10, 11, 12, 19]);
  });

  it("ignores a cursor in a node without a row", () => {
    const focus = new NodeFocus();
    focus.setCursor(cursorAt("x", 0));
    expect(keepCursorRow(rows, focus)(range)).toEqual([9, 10, 11, 12]);
  });
});
