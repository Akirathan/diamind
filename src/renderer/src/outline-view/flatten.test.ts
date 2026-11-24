import { describe, expect, it } from "vitest";
import { createOutline, ROOT } from "@/renderer/src/outline/test-outline";
import {
  changesRows,
  flattenVisible,
  OutlineRowsSource,
} from "@/renderer/src/outline-view/flatten";

const SOURCE = `
  a
    a1
      a11
    a2
  b
    b1
  c
`;

function rowsText(rows: readonly { id: string; depth: number }[]): string[] {
  return rows.map((row) => `${row.depth}:${row.id}`);
}

describe("flattenVisible", () => {
  it("lists the visible nodes in document order with their depth", () => {
    const { store } = createOutline(SOURCE);
    expect(rowsText(flattenVisible(store, ROOT))).toEqual([
      "0:a",
      "1:a1",
      "2:a11",
      "1:a2",
      "0:b",
      "1:b1",
      "0:c",
    ]);
  });

  it("skips the children of collapsed nodes", () => {
    const { store } = createOutline(SOURCE);
    store.setCollapsed("a", true);
    expect(rowsText(flattenVisible(store, ROOT))).toEqual([
      "0:a",
      "0:b",
      "1:b1",
      "0:c",
    ]);
  });

  it("skips a collapsed subtree inside an expanded one", () => {
    const { store } = createOutline(SOURCE);
    store.setCollapsed("a1", true);
    expect(rowsText(flattenVisible(store, ROOT))).toEqual([
      "0:a",
      "1:a1",
      "1:a2",
      "0:b",
      "1:b1",
      "0:c",
    ]);
  });

  it("starts the depth at 0 below the given root", () => {
    const { store } = createOutline(SOURCE);
    expect(rowsText(flattenVisible(store, "a"))).toEqual([
      "0:a1",
      "1:a11",
      "0:a2",
    ]);
  });

  it("is empty for a root without children", () => {
    const { store } = createOutline("a");
    expect(flattenVisible(store, "a")).toEqual([]);
  });
});

describe("changesRows", () => {
  it("is false for a text change", () => {
    const { store } = createOutline(SOURCE);
    expect(changesRows(store.setText("a", "x"))).toBe(false);
  });

  it("is true for structure and collapse changes", () => {
    const { store } = createOutline(SOURCE);
    expect(changesRows(store.indent("b"))).toBe(true);
    expect(changesRows(store.setCollapsed("a", true))).toBe(true);
    expect(changesRows(store.insertNode(ROOT, "c").changes)).toBe(true);
    expect(changesRows(store.deleteNode("c"))).toBe(true);
  });
});

describe("OutlineRowsSource", () => {
  it("recomputes the rows and notifies only on a structure change", () => {
    const { store } = createOutline(SOURCE);
    const source = new OutlineRowsSource(store, ROOT);
    let notified = 0;
    source.subscribe(() => notified++);
    const first = source.getRows();

    store.setText("a", "x");
    expect(notified).toBe(0);
    expect(source.getRows()).toBe(first);

    store.setCollapsed("a", true);
    expect(notified).toBe(1);
    expect(rowsText(source.getRows())).toEqual(["0:a", "0:b", "1:b1", "0:c"]);
  });

  it("keeps the rows current without a subscriber", () => {
    const { store } = createOutline(SOURCE);
    const source = new OutlineRowsSource(store, ROOT);
    store.deleteNode("b");
    expect(rowsText(source.getRows())).not.toContain("0:b");
  });

  it("stops after dispose", () => {
    const { store } = createOutline(SOURCE);
    const source = new OutlineRowsSource(store, ROOT);
    const first = source.getRows();
    source.dispose();
    store.deleteNode("b");
    expect(source.getRows()).toBe(first);
  });
});
