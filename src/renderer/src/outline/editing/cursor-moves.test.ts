import { describe, expect, it } from "vitest";
import { cursorAt } from "@/renderer/src/outline/editing/cursor";
import {
  cursorAbove,
  cursorBelow,
  cursorInOtherField,
} from "@/renderer/src/outline/editing/cursor-moves";
import {
  createOutline,
  ROOT,
} from "@/renderer/src/outline/fixtures/test-outline";

function setup(notes: Record<string, string>) {
  const { store } = createOutline(`
    a
      b
    c
  `);
  for (const [id, note] of Object.entries(notes)) {
    store.setNote(id, note);
  }
  return store;
}

describe("cursorBelow", () => {
  it("goes from the text to the note, and from the note to the next node", () => {
    const store = setup({ b: "note" });
    expect(cursorBelow(store, ROOT, { nodeId: "a", field: "text" })).toEqual(
      cursorAt("b", 0),
    );
    expect(cursorBelow(store, ROOT, { nodeId: "b", field: "text" })).toEqual(
      cursorAt("b", 0, "note"),
    );
    expect(cursorBelow(store, ROOT, { nodeId: "b", field: "note" })).toEqual(
      cursorAt("c", 0),
    );
  });

  it("is null in the note of the last node", () => {
    const store = setup({ c: "note" });
    expect(cursorBelow(store, ROOT, { nodeId: "c", field: "text" })).toEqual(
      cursorAt("c", 0, "note"),
    );
    expect(cursorBelow(store, ROOT, { nodeId: "c", field: "note" })).toBeNull();
  });
});

describe("cursorAbove", () => {
  it("goes from the note to the last line of the text", () => {
    const store = setup({ a: "note" });
    expect(cursorAbove(store, ROOT, { nodeId: "a", field: "note" })).toEqual({
      ...cursorAt("a", 1),
      toLineStart: true,
    });
    expect(cursorAbove(store, ROOT, { nodeId: "a", field: "text" })).toBeNull();
  });

  it("goes to the last line of the note of the previous visible node", () => {
    const store = setup({ a: "x", b: "1\n2" });
    expect(cursorAbove(store, ROOT, { nodeId: "c", field: "text" })).toEqual({
      ...cursorAt("b", 3, "note"),
      toLineStart: true,
    });
    store.setCollapsed("a", true);
    expect(cursorAbove(store, ROOT, { nodeId: "c", field: "text" })).toEqual({
      ...cursorAt("a", 1, "note"),
      toLineStart: true,
    });
  });

  it("goes to the beginning of a previous node without a note", () => {
    const store = setup({ c: "note" });
    expect(cursorAbove(store, ROOT, { nodeId: "c", field: "text" })).toEqual(
      cursorAt("b", 0),
    );
  });
});

describe("cursorInOtherField", () => {
  it("is at the end of the text or of the note", () => {
    const store = setup({ a: "note" });
    expect(cursorInOtherField(store, { nodeId: "a", field: "text" })).toEqual(
      cursorAt("a", 4, "note"),
    );
    expect(cursorInOtherField(store, { nodeId: "a", field: "note" })).toEqual(
      cursorAt("a", 1),
    );
    expect(cursorInOtherField(store, { nodeId: "b", field: "text" })).toEqual(
      cursorAt("b", 0, "note"),
    );
    expect(
      cursorInOtherField(store, { nodeId: "missing", field: "text" }),
    ).toBeNull();
  });
});
