import { describe, expect, it } from "vitest";
import type { NewNode } from "@/renderer/src/outline/commands/insert-tree";
import {
  createOutline,
  dump,
  expectOutlineError,
  outline,
  ROOT,
} from "@/renderer/src/outline/fixtures/test-outline";
import { UndoHistory } from "@/renderer/src/outline/history/undo";
import { OutlineStore } from "@/renderer/src/outline/store/store";

function newNode(
  text: string,
  children: readonly NewNode[] = [],
  fields: Partial<NewNode> = {},
): NewNode {
  return { text, note: "", completed: false, children, ...fields };
}

/** The texts with two spaces of indentation per level. */
function texts(store: OutlineStore, id = ROOT, depth = 0): string[] {
  return store.getChildren(id).flatMap((childId) => {
    const text = store.getNode(childId)?.text ?? "";
    const below = texts(store, childId, depth + 1);
    return ["  ".repeat(depth) + text, ...below];
  });
}

describe("appendTree", () => {
  it("adds the nodes after the last child", () => {
    const { store, clock } = createOutline(`
      a
        b
      c
    `);
    clock.now = 5000;
    const tree = [
      newNode("x", [
        newNode("x1", [newNode("x1a"), newNode("x1b")]),
        newNode("x2"),
      ]),
      newNode("y", [], { note: "note", completed: true }),
    ];
    const { ids, changes } = store.appendTree(ROOT, tree);
    expect(texts(store)).toEqual([
      "a",
      "  b",
      "c",
      "x",
      "  x1",
      "    x1a",
      "    x1b",
      "  x2",
      "y",
    ]);
    expect(ids).toEqual(store.getChildren(ROOT).slice(2));
    expect(changes.nodes.upsert).toHaveLength(6);
    expect(store.getNode(ids[0])).toMatchObject({
      type: "text",
      format: "bullet",
      note: "",
      completedAt: null,
      createdAt: 5000,
      modifiedAt: 5000,
    });
    expect(store.getNode(ids[1])).toMatchObject({
      note: "note",
      completedAt: 5000,
    });
  });

  it("adds to a node without children", () => {
    const { store } = createOutline("a");
    store.appendTree("a", [newNode("b")]);
    expect(texts(store)).toEqual(["a", "  b"]);
  });

  it("notifies once, also for no nodes", () => {
    const { store } = createOutline("a");
    let events = 0;
    store.subscribe(() => events++);
    store.appendTree(ROOT, [newNode("b", [newNode("c")]), newNode("d")]);
    expect(events).toBe(1);
    expect(store.appendTree(ROOT, []).ids).toEqual([]);
    expect(events).toBe(1);
  });

  it("allows two empty last children", () => {
    const { store } = createOutline("~a");
    store.appendTree(ROOT, [newNode(""), newNode("")]);
    expect(texts(store)).toEqual(["", "", ""]);
    store.insertNode(ROOT, null);
    expect(texts(store)).toHaveLength(4);
  });

  it("rejects a missing parent", () => {
    const { store } = createOutline("a");
    expectOutlineError(() => store.appendTree("x", []), "nodeNotFound");
  });

  it("is undone and redone as one step", () => {
    const source = `
      a
        b
    `;
    const { store } = createOutline(source);
    const history = new UndoHistory(store);
    store.appendTree(ROOT, [
      newNode("x", [newNode("y", [newNode("z")])]),
      newNode("w"),
    ]);
    const after = texts(store);
    history.undo();
    expect(dump(store)).toBe(outline(source));
    expect(store.size).toBe(3);
    history.redo();
    expect(texts(store)).toEqual(after);
  });

  it("builds an outline that can be loaded again", () => {
    const { store } = createOutline("a");
    const count = 150_000;
    const children = Array.from({ length: count }, (_, i) => newNode(`${i}`));
    const { changes } = store.appendTree("a", children);
    const root = store.getNode(ROOT);
    const a = store.getNode("a");
    if (root === undefined || a === undefined) {
      throw new Error("Missing node");
    }
    const loaded = OutlineStore.load({
      nodes: [root, a, ...changes.nodes.upsert],
    });
    expect(loaded.store.getChildren("a")).toEqual(store.getChildren("a"));
  });
});
