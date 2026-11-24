import { describe, expect, it } from "vitest";
import { createOutline } from "@/renderer/src/outline/test-outline";
import { CurrentNode } from "@/renderer/src/outline-view/current-node";
import {
  keepCurrentRow,
  withIndex,
} from "@/renderer/src/outline-view/kept-row";

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

describe("keepCurrentRow", () => {
  const ids = Array.from({ length: 20 }, (_, i) => `n${i}`);
  const rows = ids.slice(0, 19).map((id) => ({ id }));
  const range = { startIndex: 10, endIndex: 11, overscan: 1, count: 19 };

  it("adds the row of the current node", () => {
    const currentNode = new CurrentNode(createOutline(ids.join("\n")).store);
    const extract = keepCurrentRow(rows, currentNode);
    expect(extract(range)).toEqual([9, 10, 11, 12]);
    currentNode.set("n2");
    expect(extract(range)).toEqual([2, 9, 10, 11, 12]);
    currentNode.set("n18");
    expect(extract(range)).toEqual([9, 10, 11, 12, 18]);
  });

  it("ignores a current node without a row", () => {
    const currentNode = new CurrentNode(createOutline(ids.join("\n")).store);
    currentNode.set("n19");
    expect(keepCurrentRow(rows, currentNode)(range)).toEqual([9, 10, 11, 12]);
  });
});
