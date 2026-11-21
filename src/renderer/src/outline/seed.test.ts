import { describe, expect, it } from "vitest";
import { flattenVisible } from "../outline-view/flatten";
import { seedRows } from "./seed";
import { OutlineStore } from "./store";

describe("seedRows", () => {
  it("builds a valid outline with the nodes in document order", () => {
    const { store } = OutlineStore.load({ nodes: seedRows(100) });
    expect(store.size).toBe(101);
    const rows = flattenVisible(store, store.rootId);
    expect(rows).toHaveLength(100);
    expect(store.getNode(rows[0].id)?.text).toBe("Node 1");
    expect(store.getNode(rows[99].id)?.text).toBe("Node 100");
    expect(Math.max(...rows.map((row) => row.depth))).toBe(2);
  });

  it("builds only the global root for 0", () => {
    expect(seedRows(0)).toHaveLength(1);
  });
});
