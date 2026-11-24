import { describe, expect, it } from "vitest";
import {
  createOutline,
  ROOT,
} from "@/renderer/src/outline/fixtures/test-outline";
import { CurrentNode } from "@/renderer/src/outline-view/focus/current-node";
import { OutlineRowsSource } from "@/renderer/src/outline-view/rows/flatten";
import {
  CurrentIndentLine,
  indentLineSegments,
  levelOfOwner,
} from "@/renderer/src/outline-view/rows/indent-lines";

const SOURCE = `
  a
    a1
      a11
    a2
  b
    b1
`;

function setup(rootId = ROOT) {
  const { store } = createOutline(SOURCE);
  const rows = new OutlineRowsSource(store, rootId);
  const currentNode = new CurrentNode(store);
  const line = new CurrentIndentLine(store, currentNode, rows);
  let notified = 0;
  line.subscribe(() => notified++);

  /** The rows that the current line passes through, as `<row>:<level>`. */
  function currentRows(): string[] {
    return rows.getRows().flatMap(({ id, depth }) => {
      const level = line.levelInRow(id, depth);
      return level === null ? [] : [`${id}:${level}`];
    });
  }

  return { store, currentNode, currentRows, notified: () => notified };
}

describe("indentLineSegments", () => {
  it("has one segment for each ancestor", () => {
    expect(indentLineSegments(0, null)).toEqual([]);
    expect(indentLineSegments(2, null)).toEqual([
      { level: 0, current: false },
      { level: 1, current: false },
    ]);
  });

  it("marks the segment of the current line", () => {
    expect(indentLineSegments(2, 1)).toEqual([
      { level: 0, current: false },
      { level: 1, current: true },
    ]);
  });
});

describe("levelOfOwner", () => {
  const { store } = createOutline(SOURCE);

  it("is the depth of the owner for a row in its subtree", () => {
    expect(levelOfOwner(store, "a1", 1, "a")).toBe(0);
    expect(levelOfOwner(store, "a11", 2, "a")).toBe(0);
    expect(levelOfOwner(store, "a11", 2, "a1")).toBe(1);
  });

  it("is null outside of the subtree and for the owner itself", () => {
    expect(levelOfOwner(store, "a", 0, "a")).toBeNull();
    expect(levelOfOwner(store, "b1", 1, "a")).toBeNull();
    expect(levelOfOwner(store, "a1", 1, null)).toBeNull();
  });

  it("is null for the local root and the nodes above it", () => {
    expect(levelOfOwner(store, "a", 0, ROOT)).toBeNull();
    expect(levelOfOwner(store, "a11", 1, "a")).toBeNull();
    expect(levelOfOwner(store, "a11", 1, "a1")).toBe(0);
  });
});

describe("CurrentIndentLine", () => {
  it("belongs to the parent of the current node and spans its subtree", () => {
    const { currentNode, currentRows } = setup();
    expect(currentRows()).toEqual([]);
    currentNode.set("a2");
    expect(currentRows()).toEqual(["a1:0", "a11:0", "a2:0"]);
    currentNode.set("a11");
    expect(currentRows()).toEqual(["a11:1"]);
  });

  it("is not drawn for a child of the local root", () => {
    const atRoot = setup();
    atRoot.currentNode.set("a");
    expect(atRoot.currentRows()).toEqual([]);
    const zoomed = setup("a");
    zoomed.currentNode.set("a1");
    expect(zoomed.currentRows()).toEqual([]);
    zoomed.currentNode.set("a11");
    expect(zoomed.currentRows()).toEqual(["a11:0"]);
  });

  it("follows the current node when it moves in the tree", async () => {
    const { store, currentNode, currentRows, notified } = setup();
    currentNode.set("a2");
    const before = notified();
    store.indent("a2");
    await Promise.resolve();
    expect(notified()).toBeGreaterThan(before);
    expect(currentRows()).toEqual(["a11:1", "a2:1"]);
  });

  it("follows the current node out of a collapsed subtree", () => {
    const { store, currentNode, currentRows } = setup();
    currentNode.set("a11");
    store.setCollapsed("a1", true);
    expect(currentRows()).toEqual(["a1:0", "a2:0"]);
  });

  it("does not notify on a text change", () => {
    const { store, currentNode, notified } = setup();
    currentNode.set("a2");
    const before = notified();
    store.setText("a2", "x");
    expect(notified()).toBe(before);
  });
});
