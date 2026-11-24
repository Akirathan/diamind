import { describe, expect, it } from "vitest";
import type { Node, NodeFormat } from "@/shared/outline/node";
import {
  CREATED_AT,
  ROOT,
  createOutline,
  dump,
  expectRejected,
  outline,
} from "@/renderer/src/outline/fixtures/test-outline";

const node = (store: { getNode(id: string): Node | undefined }, id: string) =>
  store.getNode(id) as Node;

describe("insertNode", () => {
  it("inserts an empty bullet after a sibling", () => {
    const { store, clock } = createOutline(`
      a
      b
    `);
    clock.now = 3000;
    const { id, changes } = store.insertNode(ROOT, "a", undefined);
    expect(id).toBe("n1");
    expect(dump(store)).toBe(
      outline(`
        a
        ~n1
        b
      `),
    );
    expect(node(store, id)).toMatchObject({
      parentId: ROOT,
      type: "text",
      format: "bullet",
      text: "",
      note: "",
      completedAt: null,
      attachmentId: null,
      createdAt: 3000,
      modifiedAt: 3000,
    });
    expect(node(store, id).attributes).toBeUndefined();
    expect(changes.nodes).toEqual({
      upsert: [node(store, id)],
      delete: [],
      before: [],
    });
  });

  it("inserts as the first child if afterId is null", () => {
    const { store } = createOutline(`
      a
        b
    `);
    store.insertNode("a", null, "h1");
    expect(dump(store)).toBe(
      outline(`
        a
          ~n1
          b
      `),
    );
    expect(node(store, "n1").format).toBe("h1");
  });

  it("inserts the first child of a leaf", () => {
    const { store } = createOutline(`a`);
    store.insertNode("a", null);
    expect(store.getChildren("a")).toEqual(["n1"]);
  });

  it("keeps sort keys ordered", () => {
    const { store } = createOutline(`
      a
      b
    `);
    store.insertNode(ROOT, "a", "bullet", { text: "x" });
    store.insertNode(ROOT, "a", "bullet", { text: "y" });
    const keys = store.getChildren(ROOT).map((id) => node(store, id).sortKey);
    expect([...keys].sort()).toEqual(keys);
    expect(store.getChildren(ROOT)).toEqual(["a", "n2", "n1", "b"]);
  });

  it("inserts with text and note", () => {
    const { store } = createOutline(`a`);
    store.insertNode(ROOT, "a", "bullet", { text: "t", note: "n" });
    expect(node(store, "n1")).toMatchObject({ text: "t", note: "n" });
  });

  it("allows an empty node before a non-empty last child", () => {
    const { store } = createOutline(`
      ~e
      a
    `);
    store.insertNode(ROOT, "e", "bullet");
    expect(dump(store)).toBe(
      outline(`
        ~e
        ~n1
        a
      `),
    );
  });

  it("rejects an empty node after an empty last child", () => {
    const { store } = createOutline(`
      a
      ~e
    `);
    expectRejected(store, () => store.insertNode(ROOT, "e"), "emptyTail");
  });

  it("rejects an empty node before an empty last child", () => {
    const { store } = createOutline(`
      a
      ~e
    `);
    expectRejected(store, () => store.insertNode(ROOT, "a"), "emptyTail");
  });

  it("allows a non-empty node after an empty last child", () => {
    const { store } = createOutline(`
      ~e
    `);
    store.insertNode(ROOT, "e", "bullet", { note: "note" });
    expect(store.getChildren(ROOT)).toEqual(["e", "n1"]);
  });

  it("rejects a missing parent", () => {
    const { store } = createOutline(`a`);
    expectRejected(store, () => store.insertNode("x", null), "nodeNotFound");
  });

  it("rejects an afterId that is not a child of the parent", () => {
    const { store } = createOutline(`
      a
        b
      c
    `);
    expectRejected(store, () => store.insertNode("a", "c"), "afterNotChild");
  });

  it("rejects an unknown format", () => {
    const { store } = createOutline(`a`);
    expectRejected(
      store,
      () => store.insertNode(ROOT, "a", "code" as NodeFormat),
      "invalidFormat",
    );
  });
});

describe("indent", () => {
  it("makes the node the last child of its previous sibling", () => {
    const { store, clock } = createOutline(`
      a
        x
      b
        c
      d
    `);
    clock.now = 3000;
    const before = node(store, "b");
    const changes = store.indent("b");
    expect(dump(store)).toBe(
      outline(`
        a
          x
          b
            c
        d
      `),
    );
    expect(node(store, "b").modifiedAt).toBe(3000);
    expect(changes.nodes).toEqual({
      upsert: [node(store, "b")],
      delete: [],
      before: [before],
    });
  });

  it("indents into a leaf", () => {
    const { store } = createOutline(`
      a
      b
    `);
    store.indent("b");
    expect(store.getChildren("a")).toEqual(["b"]);
  });

  it("expands a collapsed new parent in the same change set", () => {
    const { store } = createOutline(`
      a
        x
      b
    `);
    store.setCollapsed("a", true);
    const changes = store.indent("b");
    expect(store.getUiState("a")).toEqual({
      nodeId: "a",
      collapsed: false,
      scrollTop: null,
    });
    expect(changes.nodes.upsert).toEqual([store.getNode("b")]);
    expect(changes.uiState).toEqual({
      upsert: [store.getUiState("a")],
      delete: [],
      before: [{ nodeId: "a", collapsed: true, scrollTop: null }],
    });
  });

  it("does not change the UI state of an expanded new parent", () => {
    const { store } = createOutline(`
      a
      b
    `);
    const changes = store.indent("b");
    expect(store.getUiState("a")).toBeUndefined();
    expect(changes.uiState.upsert).toEqual([]);
  });

  it("does not expand the new parent if the indent is rejected", () => {
    const { store } = createOutline(`
      a
        ~e
      ~f
      b
    `);
    store.setCollapsed("a", true);
    expectRejected(store, () => store.indent("f"), "emptyTail");
    expect(store.getUiState("a")?.collapsed).toBe(true);
  });

  it("rejects the first child", () => {
    const { store } = createOutline(`
      a
      b
    `);
    expectRejected(store, () => store.indent("a"), "noPreviousSibling");
  });

  it("rejects the global root", () => {
    const { store } = createOutline(`a`);
    expectRejected(store, () => store.indent(ROOT), "rootNotAllowed");
  });

  it("rejects a missing node", () => {
    const { store } = createOutline(`a`);
    expectRejected(store, () => store.indent("x"), "nodeNotFound");
  });

  it("rejects two empty last children in the new parent", () => {
    const { store } = createOutline(`
      a
        ~e
      ~f
      b
    `);
    expectRejected(store, () => store.indent("f"), "emptyTail");
  });

  it("rejects two empty last children in the old parent", () => {
    const { store } = createOutline(`
      a
      ~e
      ~f
      b
    `);
    expectRejected(store, () => store.indent("b"), "emptyTail");
  });
});

describe("unindent", () => {
  it("makes the node the next sibling of its parent", () => {
    const { store, clock } = createOutline(`
      a
        b
          c
        d
      e
    `);
    clock.now = 3000;
    const changes = store.unindent("b");
    expect(dump(store)).toBe(
      outline(`
        a
          d
        b
          c
        e
      `),
    );
    expect(node(store, "b")).toMatchObject({
      parentId: ROOT,
      modifiedAt: 3000,
    });
    expect(changes.nodes.upsert).toEqual([node(store, "b")]);
  });

  it("rejects a child of the global root", () => {
    const { store } = createOutline(`a`);
    expectRejected(store, () => store.unindent("a"), "parentIsRoot");
  });

  it("rejects the global root", () => {
    const { store } = createOutline(`a`);
    expectRejected(store, () => store.unindent(ROOT), "rootNotAllowed");
  });

  it("rejects two empty last children in the new parent", () => {
    const { store } = createOutline(`
      a
        ~e
      ~f
    `);
    expectRejected(store, () => store.unindent("e"), "emptyTail");
  });

  it("rejects two empty last children in the old parent", () => {
    const { store } = createOutline(`
      a
        ~e
        ~f
        b
    `);
    expectRejected(store, () => store.unindent("b"), "emptyTail");
  });
});

describe("move", () => {
  it("moves a subtree to another parent", () => {
    const { store, clock } = createOutline(`
      a
        b
      c
        d
    `);
    clock.now = 3000;
    const changes = store.move("a", "c", "d");
    expect(dump(store)).toBe(
      outline(`
        c
          d
          a
            b
      `),
    );
    expect(node(store, "a").modifiedAt).toBe(3000);
    expect(node(store, "b").modifiedAt).toBe(CREATED_AT);
    expect(changes.nodes.upsert).toEqual([node(store, "a")]);
  });

  it("moves within the same parent", () => {
    const { store } = createOutline(`
      a
      b
      c
    `);
    store.move("a", ROOT, "c");
    expect(store.getChildren(ROOT)).toEqual(["b", "c", "a"]);
    store.move("a", ROOT, null);
    expect(store.getChildren(ROOT)).toEqual(["a", "b", "c"]);
  });

  it("changes nothing if the position stays", () => {
    const { store } = createOutline(`
      a
      b
    `);
    const changes = store.move("b", ROOT, "a");
    expect(changes.nodes.upsert).toEqual([]);
    expect(node(store, "b").modifiedAt).toBe(CREATED_AT);
  });

  it("rejects the global root", () => {
    const { store } = createOutline(`a`);
    expectRejected(store, () => store.move(ROOT, "a", null), "rootNotAllowed");
  });

  it("rejects a move into its own subtree", () => {
    const { store } = createOutline(`
      a
        b
    `);
    expectRejected(store, () => store.move("a", "b", null), "moveIntoSelf");
    expectRejected(store, () => store.move("a", "a", null), "moveIntoSelf");
  });

  it("rejects a move after itself", () => {
    const { store } = createOutline(`
      a
      b
    `);
    expectRejected(store, () => store.move("b", ROOT, "b"), "afterNotChild");
  });

  it("rejects an afterId that is not a child of the new parent", () => {
    const { store } = createOutline(`
      a
      b
    `);
    expectRejected(store, () => store.move("b", "a", "a"), "afterNotChild");
  });

  it("rejects a missing node or parent", () => {
    const { store } = createOutline(`a`);
    expectRejected(store, () => store.move("x", ROOT, null), "nodeNotFound");
    expectRejected(store, () => store.move("a", "x", null), "nodeNotFound");
  });

  it("rejects two empty last children in the new parent", () => {
    const { store } = createOutline(`
      a
        ~e
      ~f
      b
    `);
    expectRejected(store, () => store.move("f", "a", "e"), "emptyTail");
  });

  it("rejects two empty last children in the old parent", () => {
    const { store } = createOutline(`
      a
        ~e
        ~f
        b
      c
    `);
    expectRejected(store, () => store.move("b", "c", null), "emptyTail");
  });

  it("rejects two empty last children by a move in the same parent", () => {
    const { store } = createOutline(`
      ~e
      a
      ~f
    `);
    expectRejected(store, () => store.move("e", ROOT, "f"), "emptyTail");
  });

  it("allows a move if the old parent already ends with two empty nodes", () => {
    const { store } = createOutline(`
      a
        b
        ~e
        ~f
      c
    `);
    store.move("b", "c", null);
    expect(store.getChildren("a")).toEqual(["e", "f"]);
  });
});

describe("deleteNode", () => {
  it("deletes the whole subtree with its UI state", () => {
    const { store } = createOutline(`
      a
        b
          c
      d
    `);
    store.setCollapsed("b", true);
    const before = ["a", "b", "c"].map((id) => node(store, id));
    const changes = store.deleteNode("a");
    expect(dump(store)).toBe(`d`);
    for (const id of ["a", "b", "c"]) {
      expect(store.getNode(id)).toBeUndefined();
      expect(store.getChildren(id)).toEqual([]);
    }
    expect(store.getUiState("b")).toBeUndefined();
    expect(changes.nodes.upsert).toEqual([]);
    expect([...changes.nodes.delete].sort()).toEqual(["a", "b", "c"]);
    expect(changes.nodes.before).toEqual(expect.arrayContaining(before));
    expect(changes.uiState.delete).toEqual(["b"]);
    expect(changes.uiState.before).toEqual([
      { nodeId: "b", collapsed: true, scrollTop: null },
    ]);
  });

  it("rejects the global root", () => {
    const { store } = createOutline(`a`);
    expectRejected(store, () => store.deleteNode(ROOT), "rootNotAllowed");
  });

  it("rejects a missing node", () => {
    const { store } = createOutline(`a`);
    expectRejected(store, () => store.deleteNode("x"), "nodeNotFound");
  });

  it("allows two empty last children left behind", () => {
    const { store } = createOutline(`
      ~e
      ~f
      a
    `);
    store.deleteNode("a");
    expect(dump(store)).toBe(
      outline(`
        ~e
        ~f
      `),
    );
  });
});

describe("empty tail with dividers", () => {
  it("allows an empty node after an empty divider", () => {
    const { store } = createOutline(`
      a
      ~d
    `);
    store.setFormat("d", "divider");
    store.insertNode(ROOT, "d");
    expect(store.getChildren(ROOT)).toEqual(["a", "d", "n1"]);
  });
});

describe("moveChildren", () => {
  it("appends the children in their order and keeps the node", () => {
    const { store } = createOutline(`
      a
        a1
      b
        b1
          b11
        b2
    `);
    store.moveChildren("b", "a");
    expect(dump(store)).toBe(
      outline(`
        a
          a1
          b1
            b11
          b2
        b
      `),
    );
  });

  it("changes nothing without children", () => {
    const { store } = createOutline(`
      a
      b
    `);
    expect(store.moveChildren("a", "b").nodes.upsert).toEqual([]);
  });

  it("rejects an empty tail, unknown nodes and its own subtree", () => {
    const { store } = createOutline(`
      a
        ~a1
      b
        ~b1
    `);
    expectRejected(store, () => store.moveChildren("b", "a"), "emptyTail");
    expectRejected(store, () => store.moveChildren("x", "a"), "nodeNotFound");
    expectRejected(store, () => store.moveChildren("a", "x"), "nodeNotFound");
    expectRejected(store, () => store.moveChildren("a", "a1"), "moveIntoSelf");
  });
});

describe("dissolveNode", () => {
  it("appends the children to the new parent and deletes the node", () => {
    const { store, clock } = createOutline(`
      a
        a1
      b
        b1
          b11
        b2
      c
    `);
    store.setCollapsed("b", true);
    clock.now = 3000;
    const changes = store.dissolveNode("b", "a");
    expect(dump(store)).toBe(
      outline(`
        a
          a1
          b1
            b11
          b2
        c
      `),
    );
    expect(changes.nodes.delete).toEqual(["b"]);
    expect(changes.nodes.upsert.map((n) => n.id)).toEqual(["b1", "b2"]);
    expect(changes.uiState.delete).toEqual(["b"]);
    expect(node(store, "b1").modifiedAt).toBe(3000);
    expect(node(store, "b11").modifiedAt).toBe(CREATED_AT);
  });

  it("appends to the parent of the node", () => {
    const { store } = createOutline(`
      a
        b
          c
        d
    `);
    store.dissolveNode("b", "a");
    expect(dump(store)).toBe(
      outline(`
        a
          d
          c
      `),
    );
  });

  it("checks only the final children against the empty rule", () => {
    const { store } = createOutline(`
      a
        ~a1
      b
        ~b1
        c
    `);
    store.dissolveNode("b", "a");
    expect(store.getChildren("a")).toEqual(["a1", "b1", "c"]);
  });

  it("accepts two empty nodes that already were at the end", () => {
    const { store } = createOutline(`
      a
      b
        ~b1
        ~b2
        c
    `);
    store.deleteNode("c");
    store.dissolveNode("b", "a");
    expect(store.getChildren("a")).toEqual(["b1", "b2"]);
  });

  it("does not count the deleted node in the empty rule", () => {
    const { store } = createOutline(`
      a
        ~b
          ~c
    `);
    store.dissolveNode("b", "a");
    expect(store.getChildren("a")).toEqual(["c"]);
  });

  it("rejects two empty nodes at the end of the new parent", () => {
    const { store } = createOutline(`
      a
        ~a1
      b
        ~b1
    `);
    expectRejected(store, () => store.dissolveNode("b", "a"), "emptyTail");
  });

  it("rejects the root, unknown nodes and its own subtree", () => {
    const { store } = createOutline(`
      a
        b
    `);
    expectRejected(
      store,
      () => store.dissolveNode(ROOT, "a"),
      "rootNotAllowed",
    );
    expectRejected(store, () => store.dissolveNode("x", "a"), "nodeNotFound");
    expectRejected(store, () => store.dissolveNode("a", "x"), "nodeNotFound");
    expectRejected(store, () => store.dissolveNode("a", "b"), "moveIntoSelf");
  });
});
