import { describe, expect, it } from "vitest";
import { cursorAt } from "@/renderer/src/outline/editing/cursor";
import {
  createOutline,
  dump,
  outline,
  snapshot,
} from "@/renderer/src/outline/fixtures/test-outline";
import { OutlineStore } from "@/renderer/src/outline/store/store";
import { createZoom, settle } from "@/renderer/src/outline-view/zoom/test-zoom";

function setup(source: string) {
  const { store } = createOutline(source);
  return { store, ...createZoom(store) };
}

/** Zoomed into `a`, which gets the placeholder `n1`. */
function zoomed() {
  const context = setup("a\nb");
  context.zoom.zoomTo("a");
  return context;
}

const WITH_PLACEHOLDER = outline(`
  a
    ~n1
  b
`);

describe("RootPlaceholder", () => {
  it("is created in an empty outline and never removed there", async () => {
    const { store } = OutlineStore.load({ nodes: [] });
    const { zoom } = createZoom(store);
    const [id] = store.getChildren(store.rootId);
    zoom.zoomTo(id);
    zoom.back();
    await settle();
    expect(store.getChildren(store.rootId)).toEqual([id]);
    expect(store.getChildren(id)).toEqual([]);
  });

  it("is created on zoom and removed on leave, without undo steps", () => {
    const { store, zoom, history } = zoomed();
    expect(dump(store)).toBe(WITH_PLACEHOLDER);
    zoom.zoomTo("b");
    expect(dump(store)).toBe("a\nb\n  ~n2");
    zoom.back();
    zoom.back();
    expect(dump(store)).toBe("a\nb");
    expect(history.canUndo).toBe(false);
  });

  it("stays when it has text", () => {
    const { store, zoom } = zoomed();
    store.setText("n1", "x");
    zoom.back();
    expect(dump(store)).toBe("a\n  n1\nb");
  });

  it("stays when it has a child", () => {
    const { store, zoom } = zoomed();
    store.insertNode("n1", null, "bullet", { text: "x" });
    zoom.back();
    expect(dump(store)).toContain("~n1");
  });

  it("is removed on leave after its text was undone", async () => {
    const { store, zoom, history } = zoomed();
    store.setText("n1", "x");
    history.undo();
    await settle();
    expect(dump(store)).toBe(WITH_PLACEHOLDER);
    zoom.back();
    expect(dump(store)).toBe("a\nb");

    history.redo();
    expect(store.getNode("n1")?.text).toBe("x");
    history.undo();
    await settle();
    expect(dump(store)).toBe("a\nb");
  });

  it("comes back when the last child is gone, and goes with an undo", async () => {
    const { store, zoom, history } = setup("a\n  c\nb");
    zoom.zoomTo("a");
    const before = snapshot(store);
    store.deleteNode("c");
    await settle();
    expect(dump(store)).toBe(WITH_PLACEHOLDER);
    history.undo();
    await settle();
    expect(snapshot(store)).toEqual(before);
  });

  it("is removed when it gets a sibling", async () => {
    const { store } = zoomed();
    store.insertNode("a", null, "bullet", { text: "x" });
    await settle();
    expect(dump(store)).toBe("a\n  n2\nb");
  });

  it("hands the cursor to its parent when an undo makes it useless", async () => {
    const { store, zoom, history, focus, putCursor } = zoomed();
    putCursor("n1");
    store.setText("n1", "x");
    zoom.back();
    history.undo();
    await settle();
    expect(dump(store)).toBe("a\nb");
    expect(focus.cursor).toEqual(cursorAt("a", 1));
  });

  it("is removed with a parent that undo removes", async () => {
    const { store, editing, zoom, history } = setup("a");
    editing.enter("a", 1, 1);
    const [, newId] = store.getChildren(store.rootId);
    zoom.zoomTo(newId);
    store.setText(store.getChildren(newId)[0], "x");
    history.undo();
    history.undo();
    await settle();
    expect(dump(store)).toBe("a");
    expect(store.size).toBe(2);
    history.redo();
    history.redo();
    expect(store.size).toBe(4);
  });

  it("of the last session is removed on leave", () => {
    const first = zoomed();
    const { store } = OutlineStore.load({
      nodes: ["root", "a", "b", "n1"].map((id) => first.store.getNode(id)!),
    });
    const { zoom } = createZoom(store, { zoomedNodeId: "a" });
    expect(dump(store)).toBe(WITH_PLACEHOLDER);
    zoom.up();
    expect(dump(store)).toBe("a\nb");
  });

  it("does not adopt an edited empty child", () => {
    const { store, clock } = createOutline("a\n  c");
    clock.now++;
    store.setText("c", "");
    const { zoom } = createZoom(store, { zoomedNodeId: "a" });
    zoom.up();
    expect(dump(store)).toBe("a\n  ~c");
  });
});
