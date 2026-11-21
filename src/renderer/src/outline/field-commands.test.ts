import { describe, expect, it } from "vitest";
import type { JsonValue, Node, NodeFormat } from "../../../shared/outline/node";
import { OutlineStore } from "./store";
import {
  CREATED_AT,
  ROOT,
  createOutline,
  expectRejected,
  testNode,
} from "./test-outline";

const node = (store: OutlineStore, id: string) => store.getNode(id) as Node;

describe("setText", () => {
  it("changes the text and modifiedAt", () => {
    const { store, clock } = createOutline(`a`);
    const before = node(store, "a");
    clock.now = 3000;
    const changes = store.setText("a", "hello");
    expect(node(store, "a")).toMatchObject({ text: "hello", modifiedAt: 3000 });
    expect(node(store, "a").createdAt).toBe(CREATED_AT);
    expect(changes.nodes).toEqual({
      upsert: [node(store, "a")],
      delete: [],
      before: [before],
    });
    expect(before.text).toBe("a");
  });

  it("changes nothing for the same text", () => {
    const { store } = createOutline(`a`);
    const changes = store.setText("a", "a");
    expect(changes.nodes.upsert).toEqual([]);
    expect(node(store, "a").modifiedAt).toBe(CREATED_AT);
  });

  it("allows a text that leaves two empty last children", () => {
    const { store } = createOutline(`
      ~e
      a
    `);
    store.setText("a", "");
    expect(node(store, "a").text).toBe("");
  });

  it("rejects a missing node", () => {
    const { store } = createOutline(`a`);
    expectRejected(store, () => store.setText("x", "t"), "nodeNotFound");
  });

  it("rejects text in an attachment node", () => {
    const { store } = OutlineStore.load({
      nodes: [
        testNode(ROOT, null, "a0"),
        {
          ...testNode("img", ROOT, "a0", ""),
          type: "attachment",
          attachmentId: "file",
        },
      ],
    });
    expectRejected(store, () => store.setText("img", "t"), "attachmentText");
    expect(store.setText("img", "").nodes.upsert).toEqual([]);
  });
});

describe("setNote", () => {
  it("changes the note and modifiedAt", () => {
    const { store, clock } = createOutline(`a`);
    clock.now = 3000;
    const changes = store.setNote("a", "line 1\nline 2");
    expect(node(store, "a")).toMatchObject({
      note: "line 1\nline 2",
      modifiedAt: 3000,
    });
    expect(changes.nodes.upsert).toEqual([node(store, "a")]);
  });

  it("allows a note that leaves two empty last children", () => {
    const { store } = createOutline(`
      a
      ~e
      ~f
    `);
    store.setNote("f", "note");
    store.setNote("f", "");
    expect(node(store, "f").note).toBe("");
  });

  it("rejects a missing node", () => {
    const { store } = createOutline(`a`);
    expectRejected(store, () => store.setNote("x", "n"), "nodeNotFound");
  });
});

describe("setFormat", () => {
  it("changes the format", () => {
    const { store, clock } = createOutline(`a`);
    clock.now = 3000;
    store.setFormat("a", "h2");
    expect(node(store, "a")).toMatchObject({ format: "h2", modifiedAt: 3000 });
  });

  it("changes nothing for the same format", () => {
    const { store } = createOutline(`a`);
    expect(store.setFormat("a", "bullet").nodes.upsert).toEqual([]);
  });

  it("rejects an unknown format", () => {
    const { store } = createOutline(`a`);
    expectRejected(
      store,
      () => store.setFormat("a", "code" as NodeFormat),
      "invalidFormat",
    );
  });

  it("rejects a missing node", () => {
    const { store } = createOutline(`a`);
    expectRejected(store, () => store.setFormat("x", "h1"), "nodeNotFound");
  });
});

describe("setCompleted", () => {
  it("completes and uncompletes several nodes", () => {
    const { store, clock } = createOutline(`
      a
      b
    `);
    clock.now = 3000;
    const changes = store.setCompleted(["a", "b"], true);
    expect(node(store, "a")).toMatchObject({
      completedAt: 3000,
      modifiedAt: 3000,
    });
    expect(node(store, "b").completedAt).toBe(3000);
    expect(changes.nodes.upsert).toHaveLength(2);

    clock.now = 4000;
    store.setCompleted(["a"], false);
    expect(node(store, "a")).toMatchObject({
      completedAt: null,
      modifiedAt: 4000,
    });
  });

  it("keeps the time of an already completed node", () => {
    const { store, clock } = createOutline(`
      a
      b
    `);
    clock.now = 3000;
    store.setCompleted(["a"], true);
    clock.now = 4000;
    const changes = store.setCompleted(["a", "b"], true);
    expect(node(store, "a").completedAt).toBe(3000);
    expect(node(store, "b").completedAt).toBe(4000);
    expect(changes.nodes.upsert.map((n) => n.id)).toEqual(["b"]);
  });

  it("does not complete the children", () => {
    const { store } = createOutline(`
      a
        b
    `);
    store.setCompleted(["a"], true);
    expect(node(store, "b").completedAt).toBeNull();
  });

  it("rejects all ids if one is missing", () => {
    const { store } = createOutline(`a`);
    expectRejected(
      store,
      () => store.setCompleted(["a", "x"], true),
      "nodeNotFound",
    );
  });
});

describe("setCollapsed", () => {
  it("creates and updates the UI state without changing the node", () => {
    const { store, clock } = createOutline(`
      a
        b
    `);
    clock.now = 3000;
    const changes = store.setCollapsed("a", true);
    expect(store.getUiState("a")).toEqual({
      nodeId: "a",
      collapsed: true,
      scrollTop: null,
    });
    expect(changes.uiState).toEqual({
      upsert: [store.getUiState("a")],
      delete: [],
      before: [],
    });
    expect(changes.nodes.upsert).toEqual([]);
    expect(node(store, "a").modifiedAt).toBe(CREATED_AT);

    const expanded = store.setCollapsed("a", false);
    expect(store.getUiState("a")?.collapsed).toBe(false);
    expect(expanded.uiState.before).toEqual([
      { nodeId: "a", collapsed: true, scrollTop: null },
    ]);
  });

  it("keeps the scroll position", () => {
    const { store } = OutlineStore.load({
      nodes: [testNode(ROOT, null, "a0"), testNode("a", ROOT, "a0")],
      uiState: [{ nodeId: "a", collapsed: false, scrollTop: 42 }],
    });
    store.setCollapsed("a", true);
    expect(store.getUiState("a")).toEqual({
      nodeId: "a",
      collapsed: true,
      scrollTop: 42,
    });
  });

  it("changes nothing for the same state", () => {
    const { store } = createOutline(`a`);
    expect(store.setCollapsed("a", false).uiState.upsert).toEqual([]);
    expect(store.getUiState("a")).toBeUndefined();
  });

  it("rejects a missing node", () => {
    const { store } = createOutline(`a`);
    expectRejected(store, () => store.setCollapsed("x", true), "nodeNotFound");
  });
});

describe("setAttribute", () => {
  it("adds and replaces attributes", () => {
    const { store, clock } = createOutline(`a`);
    clock.now = 3000;
    store.setAttribute("a", "due", "2026-12-01");
    store.setAttribute("a", "meta", { tags: ["x", 1, true, null] });
    expect(node(store, "a").attributes).toEqual({
      due: "2026-12-01",
      meta: { tags: ["x", 1, true, null] },
    });
    expect(node(store, "a").modifiedAt).toBe(3000);

    const before = node(store, "a");
    const changes = store.setAttribute("a", "due", null);
    expect(node(store, "a").attributes?.due).toBeNull();
    expect(changes.nodes.before).toEqual([before]);
    expect(before.attributes?.due).toBe("2026-12-01");
  });

  it("copies the value", () => {
    const { store } = createOutline(`a`);
    const value = { list: [1] };
    store.setAttribute("a", "v", value);
    value.list.push(2);
    expect(node(store, "a").attributes?.v).toEqual({ list: [1] });
  });

  it("changes nothing for the same value", () => {
    const { store } = createOutline(`a`);
    store.setAttribute("a", "v", [1, 2]);
    expect(store.setAttribute("a", "v", [1, 2]).nodes.upsert).toEqual([]);
  });

  it("rejects an empty key", () => {
    const { store } = createOutline(`a`);
    expectRejected(
      store,
      () => store.setAttribute("a", "", 1),
      "invalidAttributeKey",
    );
  });

  it("rejects values that are not JSON", () => {
    const { store } = createOutline(`a`);
    const invalid: unknown[] = [
      undefined,
      Number.NaN,
      Infinity,
      () => 1,
      new Date(0),
      [undefined],
      { nested: new Map() },
    ];
    for (const value of invalid) {
      expectRejected(
        store,
        () => store.setAttribute("a", "v", value as JsonValue),
        "invalidAttributeValue",
      );
    }
  });

  it("rejects a missing node", () => {
    const { store } = createOutline(`a`);
    expectRejected(
      store,
      () => store.setAttribute("x", "k", 1),
      "nodeNotFound",
    );
  });
});

describe("removeAttribute", () => {
  it("removes a key and drops empty attributes", () => {
    const { store, clock } = createOutline(`a`);
    store.setAttribute("a", "k1", 1);
    store.setAttribute("a", "k2", 2);
    clock.now = 3000;
    store.removeAttribute("a", "k1");
    expect(node(store, "a").attributes).toEqual({ k2: 2 });
    expect(node(store, "a").modifiedAt).toBe(3000);

    store.removeAttribute("a", "k2");
    expect(node(store, "a").attributes).toBeUndefined();
    expect("attributes" in node(store, "a")).toBe(false);
  });

  it("changes nothing for a missing key", () => {
    const { store } = createOutline(`a`);
    expect(store.removeAttribute("a", "k").nodes.upsert).toEqual([]);
    store.setAttribute("a", "k", 1);
    expect(store.removeAttribute("a", "other").nodes.upsert).toEqual([]);
  });

  it("rejects a missing node", () => {
    const { store } = createOutline(`a`);
    expectRejected(
      store,
      () => store.removeAttribute("x", "k"),
      "nodeNotFound",
    );
  });
});
