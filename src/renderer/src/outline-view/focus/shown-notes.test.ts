import { describe, expect, it } from "vitest";
import { cursorAt } from "@/renderer/src/outline/editing/cursor";
import { createOutline } from "@/renderer/src/outline/fixtures/test-outline";
import { CurrentNode } from "@/renderer/src/outline-view/focus/current-node";
import { NodeFocus } from "@/renderer/src/outline-view/focus/node-focus";
import { ShownNotes } from "@/renderer/src/outline-view/focus/shown-notes";

const SOURCE = `
  a
    b
  c
`;

function setup() {
  const { store } = createOutline(SOURCE);
  const currentNode = new CurrentNode(store);
  const focus = new NodeFocus(currentNode);
  const notes = new ShownNotes(store, focus, currentNode);
  const notified: string[] = [];
  for (const id of ["a", "b", "c"]) {
    notes.subscribe(id, () => notified.push(id));
  }

  function shown(): string[] {
    return ["a", "b", "c"].filter((id) => notes.isShown(id));
  }

  return { store, focus, currentNode, notes, notified, shown };
}

describe("ShownNotes", () => {
  it("shows the notes with text", () => {
    const { store, shown, notified } = setup();
    expect(shown()).toEqual([]);
    store.setNote("b", "note");
    expect(shown()).toEqual(["b"]);
    expect(notified).toEqual(["b"]);
    store.setNote("b", "");
    expect(shown()).toEqual([]);
  });

  it("shows an empty note only while it has the cursor", () => {
    const { focus, shown, notified } = setup();
    focus.request(cursorAt("a", 0, "note"));
    expect(shown()).toEqual(["a"]);
    expect(notified).toEqual(["a"]);
    focus.setCursor(cursorAt("a", 0, "note"));
    expect(notified).toEqual(["a"]);
    focus.request(cursorAt("c", 0, "note"));
    expect(shown()).toEqual(["c"]);
    focus.setCursor(cursorAt("c", 0));
    expect(shown()).toEqual([]);
  });

  it("keeps a note that became empty until the cursor leaves", () => {
    const { store, focus, shown } = setup();
    store.setNote("a", "n");
    focus.request(cursorAt("a", 1, "note"));
    store.setNote("a", "");
    expect(shown()).toEqual(["a"]);
    focus.request(cursorAt("b", 0));
    expect(shown()).toEqual([]);
  });

  it("removes an empty note whose node is hidden or deleted", () => {
    const { store, focus, shown } = setup();
    focus.request(cursorAt("b", 0, "note"));
    store.setCollapsed("a", true);
    expect(shown()).toEqual([]);
    focus.request(cursorAt("c", 0, "note"));
    store.deleteNode("c");
    expect(shown()).toEqual([]);
  });

  it("does not notify after an unsubscribe", () => {
    const { store, notes, notified } = setup();
    let count = 0;
    const unsubscribe = notes.subscribe("a", () => count++);
    unsubscribe();
    store.setNote("a", "x");
    expect(count).toBe(0);
    expect(notified).toEqual(["a"]);
  });
});
