import { describe, expect, it } from "vitest";
import type { ChangeSet } from "../../../shared/outline/change-set";
import type { Node } from "../../../shared/outline/node";
import { OutlineStore, type OutlineEvent } from "./store";
import { ROOT, createOutline } from "./test-outline";

function listen(store: OutlineStore) {
  const events: OutlineEvent[] = [];
  const unsubscribe = store.subscribe((event) => events.push(event));
  return { events, unsubscribe };
}

describe("subscribe", () => {
  it("notifies a text change with the node only", () => {
    const { store } = createOutline(`a`);
    const { events } = listen(store);
    const changes = store.setText("a", "x");
    expect(events).toHaveLength(1);
    expect([...events[0].changedIds]).toEqual(["a"]);
    expect(events[0].changes).toBe(changes);
  });

  it("notifies the old and new parent of a moved node", () => {
    const { store } = createOutline(`
      a
        b
      c
    `);
    const { events } = listen(store);
    store.move("b", "c", null);
    expect([...events[0].changedIds].sort()).toEqual(["a", "b", "c"]);
  });

  it("notifies the parent of an inserted node", () => {
    const { store } = createOutline(`a`);
    const { events } = listen(store);
    const { id } = store.insertNode("a", null);
    expect([...events[0].changedIds].sort()).toEqual(["a", id]);
  });

  it("notifies the parent of a deleted subtree", () => {
    const { store } = createOutline(`
      a
        b
    `);
    const { events } = listen(store);
    store.deleteNode("a");
    expect([...events[0].changedIds].sort()).toEqual(["a", "b", ROOT]);
  });

  it("notifies a UI state change", () => {
    const { store } = createOutline(`a`);
    const { events } = listen(store);
    store.setCollapsed("a", true);
    expect([...events[0].changedIds]).toEqual(["a"]);
  });

  it("does not notify a command that changes nothing", () => {
    const { store } = createOutline(`a`);
    const { events } = listen(store);
    store.setText("a", "a");
    store.removeAttribute("a", "k");
    expect(events).toEqual([]);
  });

  it("does not notify a rejected command", () => {
    const { store } = createOutline(`a`);
    const { events } = listen(store);
    expect(() => store.deleteNode(ROOT)).toThrow();
    expect(events).toEqual([]);
  });

  it("stops after unsubscribe", () => {
    const { store } = createOutline(`a`);
    const { events, unsubscribe } = listen(store);
    unsubscribe();
    store.setText("a", "x");
    expect(events).toEqual([]);
  });
});

function allNodes(store: OutlineStore): Node[] {
  const result: Node[] = [];
  const visit = (id: string): void => {
    result.push(store.getNode(id) as Node);
    store.getChildren(id).forEach(visit);
  };
  visit(store.rootId);
  return result;
}

/** Applies the inverse of `changes` to the rows, as undo would do. */
function revert(rows: Node[], changes: ChangeSet): Node[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const row of changes.nodes.upsert) {
    byId.delete(row.id);
  }
  for (const row of changes.nodes.before) {
    byId.set(row.id, row);
  }
  return [...byId.values()];
}

describe("change set", () => {
  const source = `
    a
      b
        c
    d
      e
  `;
  const commands: [string, (store: OutlineStore) => ChangeSet][] = [
    ["insertNode", (store) => store.insertNode("a", "b").changes],
    ["setText", (store) => store.setText("a", "x")],
    ["setNote", (store) => store.setNote("a", "x")],
    ["setFormat", (store) => store.setFormat("a", "h1")],
    ["setCompleted", (store) => store.setCompleted(["a", "e"], true)],
    ["indent", (store) => store.indent("d")],
    ["unindent", (store) => store.unindent("c")],
    ["move", (store) => store.move("b", "d", "e")],
    ["deleteNode", (store) => store.deleteNode("a")],
    ["setAttribute", (store) => store.setAttribute("a", "k", 1)],
  ];

  for (const [name, run] of commands) {
    it(`holds enough rows to revert ${name}`, () => {
      const { store } = createOutline(source);
      const original = allNodes(store);
      const changes = run(store);
      const reverted = OutlineStore.load({
        nodes: revert(allNodes(store), changes),
      }).store;
      expect(allNodes(reverted)).toEqual(original);
    });
  }
});
