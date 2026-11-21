import { describe, expect, it } from "vitest";
import { OutlineStore } from "./store";
import {
  createOutline,
  dump,
  expectOutlineError,
  outline,
  testNode,
} from "./test-outline";

describe("load", () => {
  it("creates the global root for an empty outline", () => {
    const { store, changes } = OutlineStore.load(
      { nodes: [] },
      { now: () => 5, newId: () => "r" },
    );
    expect(store.rootId).toBe("r");
    expect(store.size).toBe(1);
    expect(store.getNode("r")).toMatchObject({
      parentId: null,
      type: "text",
      format: "bullet",
      text: "",
      createdAt: 5,
      modifiedAt: 5,
    });
    expect(changes.nodes.upsert).toEqual([store.getNode("r")]);
    expect(changes.nodes.before).toEqual([]);
  });

  it("returns no changes for an existing outline", () => {
    const { changes } = OutlineStore.load({
      nodes: [testNode("root", null, "a0")],
    });
    expect(changes.nodes.upsert).toEqual([]);
  });

  it("sorts children by sort key in code unit order", () => {
    const nodes = [
      testNode("root", null, "a0"),
      testNode("lower", "root", "a0a"),
      testNode("upper", "root", "a0Z"),
      testNode("first", "root", "Zz"),
    ];
    const { store } = OutlineStore.load({ nodes });
    expect(store.getChildren("root")).toEqual(["first", "upper", "lower"]);
  });

  it("builds nested children independent of the row order", () => {
    const { store } = createOutline(`
      a
        b
          c
        d
      e
    `);
    expect(dump(store)).toBe(
      outline(`
        a
          b
            c
          d
        e
      `),
    );
    expect(store.getChildren("c")).toEqual([]);
  });

  it("loads the UI state of existing nodes only", () => {
    const { store } = OutlineStore.load({
      nodes: [testNode("root", null, "a0"), testNode("a", "root", "a0")],
      uiState: [
        { nodeId: "a", collapsed: true, scrollTop: 10 },
        { nodeId: "gone", collapsed: true, scrollTop: null },
      ],
    });
    expect(store.getUiState("a")).toEqual({
      nodeId: "a",
      collapsed: true,
      scrollTop: 10,
    });
    expect(store.getUiState("gone")).toBeUndefined();
  });

  it("rejects an outline without a root", () => {
    expectOutlineError(
      () => OutlineStore.load({ nodes: [testNode("a", "b", "a0")] }),
      "invalidOutline",
    );
  });

  it("rejects more than one root", () => {
    expectOutlineError(
      () =>
        OutlineStore.load({
          nodes: [testNode("r1", null, "a0"), testNode("r2", null, "a1")],
        }),
      "invalidOutline",
    );
  });

  it("rejects a duplicate id", () => {
    expectOutlineError(
      () =>
        OutlineStore.load({
          nodes: [testNode("root", null, "a0"), testNode("root", null, "a1")],
        }),
      "invalidOutline",
    );
  });

  it("rejects a missing parent", () => {
    expectOutlineError(
      () =>
        OutlineStore.load({
          nodes: [testNode("root", null, "a0"), testNode("a", "x", "a0")],
        }),
      "invalidOutline",
    );
  });

  it("rejects a cycle", () => {
    expectOutlineError(
      () =>
        OutlineStore.load({
          nodes: [
            testNode("root", null, "a0"),
            testNode("a", "b", "a0"),
            testNode("b", "a", "a0"),
          ],
        }),
      "invalidOutline",
    );
  });
});
