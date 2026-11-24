import { describe, expect, it } from "vitest";
import type { AppStateValues } from "@/shared/app-state";
import { cursorAt } from "@/renderer/src/outline/editing/cursor";
import {
  createOutline,
  dump,
  outline,
  ROOT,
  snapshot,
} from "@/renderer/src/outline/fixtures/test-outline";
import { createZoom, settle } from "@/renderer/src/outline-view/zoom/test-zoom";

const SOURCE = `
  a
    a1
      a11
    a2
  b
    b1
`;

function setup(source = SOURCE, saved?: AppStateValues) {
  const { store } = createOutline(source);
  return { store, ...createZoom(store, saved) };
}

describe("navigation", () => {
  it("goes back, forward and up", () => {
    const { zoom, localRoot } = setup();
    expect(zoom.getState()).toEqual({
      canGoBack: false,
      canGoForward: false,
      canGoUp: false,
    });
    zoom.zoomTo("a1");
    zoom.up();
    expect(localRoot.get()).toBe("a");
    zoom.back();
    expect(localRoot.get()).toBe("a1");
    expect(zoom.getState()).toEqual({
      canGoBack: true,
      canGoForward: true,
      canGoUp: true,
    });
    zoom.back();
    expect(localRoot.get()).toBe(ROOT);
    zoom.back();
    zoom.up();
    expect(localRoot.get()).toBe(ROOT);
    zoom.forward();
    zoom.forward();
    expect(localRoot.get()).toBe("a");
    zoom.forward();
    expect(localRoot.get()).toBe("a");
  });

  it("ignores unknown nodes and the local root itself", () => {
    const { zoom, localRoot } = setup();
    zoom.zoomTo("x");
    zoom.zoomTo(ROOT);
    expect(localRoot.get()).toBe(ROOT);
    expect(zoom.getState().canGoBack).toBe(false);
  });

  it("skips deleted nodes until they come back", () => {
    const { store, zoom, history, localRoot } = setup();
    zoom.zoomTo("b");
    zoom.zoomTo("a");
    store.deleteNode("b");
    let notified = 0;
    zoom.subscribe(() => notified++);
    zoom.back();
    expect(localRoot.get()).toBe(ROOT);
    expect(notified).toBe(1);
    history.undo();
    zoom.forward();
    expect(localRoot.get()).toBe("b");
  });

  it("disables back when the only other entry is deleted", () => {
    const { store, zoom } = setup(SOURCE, {
      zoomedNodeId: "a",
      navigationHistory: { entries: ["b", "a"], index: 1 },
    });
    expect(zoom.getState().canGoBack).toBe(true);
    store.deleteNode("b");
    expect(zoom.getState().canGoBack).toBe(false);
  });

  it("is not an undo step", () => {
    const { zoom, history } = setup();
    zoom.zoomTo("a");
    zoom.zoomTo("a11");
    zoom.back();
    expect(history.canUndo).toBe(false);
  });

  it("keeps the collapse state", () => {
    const { store, zoom } = setup();
    store.setCollapsed("a", true);
    store.setCollapsed("a1", true);
    const before = snapshot(store);
    zoom.zoomTo("a");
    zoom.zoomTo("a1");
    zoom.back();
    zoom.back();
    expect(snapshot(store)).toEqual(before);
  });
});

describe("a deleted local root", () => {
  it("is replaced by the nearest existing ancestor", () => {
    const { store, zoom, localRoot } = setup();
    zoom.zoomTo("a");
    zoom.zoomTo("a11");
    store.deleteNode("a1");
    expect(localRoot.get()).toBe("a");
    expect(zoom.getState().canGoBack).toBe(true);
    zoom.back();
    expect(localRoot.get()).toBe(ROOT);
  });

  it("is left on undo and redo", async () => {
    const { store, editing, history, zoom, localRoot, focus, putCursor } =
      setup("a");
    putCursor("a", 1);
    editing.enter("a", 1, 1);
    zoom.zoomTo("n1");
    await settle();
    history.undo();
    await settle();
    expect(localRoot.get()).toBe(ROOT);
    expect(dump(store)).toBe("a");
    expect(focus.cursor).toEqual(cursorAt("a", 1));

    history.redo();
    zoom.zoomTo("n1");
    history.undo();
    history.redo();
    await settle();
    expect(localRoot.get()).toBe(ROOT);
    expect(dump(store)).toBe("a\n~n1");
  });

  it("is left when its node merges away on redo", async () => {
    const { store, editing, history, zoom, localRoot } = setup("a\nb");
    editing.mergeIntoUpper("b");
    history.undo();
    zoom.zoomTo("b");
    history.redo();
    await settle();
    expect(localRoot.get()).toBe(ROOT);
    expect(dump(store)).toBe("a");
    expect(store.size).toBe(2);
  });
});

describe("undo of a change outside of the local root", () => {
  it("changes the node and keeps the view and the cursor", () => {
    const { store, history, zoom, localRoot, focus, putCursor } = setup();
    putCursor("b1", 2);
    store.setText("b1", "changed");
    zoom.zoomTo("a");
    putCursor("a2", 1);
    history.undo();
    expect(store.getNode("b1")?.text).toBe("b1");
    expect(localRoot.get()).toBe("a");
    expect(focus.cursor).toEqual(cursorAt("a2", 1));
  });

  it("keeps the cursor when an ancestor of the local root collapses", () => {
    const { store, history, zoom, focus, putCursor } = setup();
    store.setCollapsed("a", true);
    history.undo();
    zoom.zoomTo("a1");
    putCursor("a11", 1);
    history.redo();
    expect(focus.cursor).toEqual(cursorAt("a11", 1));
  });
});

describe("the cursor after a zoom", () => {
  it("stays in a visible node", () => {
    const { zoom, focus, putCursor } = setup();
    putCursor("a11", 2);
    zoom.zoomTo("a");
    expect(focus.cursor).toEqual(cursorAt("a11", 2));
    zoom.up();
    expect(focus.cursor).toEqual(cursorAt("a11", 2));
  });

  it("goes to the end of the title", () => {
    const { zoom, focus, putCursor } = setup();
    putCursor("b", 0);
    zoom.zoomTo("a1");
    expect(focus.cursor).toEqual(cursorAt("a1", 2));
  });

  it("goes to the node that was zoomed out of", () => {
    const { store, zoom, focus } = setup();
    store.setCollapsed("a1", true);
    zoom.zoomTo("a1");
    focus.request(cursorAt("a11", 0));
    zoom.up();
    expect(focus.cursor).toEqual(cursorAt("a1", 2));
  });

  it("goes to the only empty child", () => {
    const { zoom, focus, putCursor } = setup();
    putCursor("a2", 1);
    zoom.zoomTo("a2");
    expect(focus.cursor).toEqual(cursorAt("n1", 0));
  });

  it("goes to the first node if the global root does not show the old one", () => {
    const { store, zoom, focus } = setup();
    store.setCollapsed("b", true);
    zoom.zoomTo("b1");
    zoom.back();
    expect(focus.cursor).toEqual(cursorAt("a", 0));
  });

  it("is revealed only if the scroll position is not restored", () => {
    const { store, zoom, focus } = setup();
    store.setScrollTop(ROOT, 100);
    zoom.zoomTo("a");
    expect(focus.getRequest()?.keepScroll).toBe(false);
    zoom.back();
    expect(focus.getRequest()?.keepScroll).toBe(true);
  });
});

describe("the saved state", () => {
  it("is restored", () => {
    const first = setup();
    first.zoom.zoomTo("a");
    first.zoom.zoomTo("a1");
    first.zoom.back();
    const second = setup(SOURCE, {
      zoomedNodeId: first.appState.get("zoomedNodeId"),
      navigationHistory: first.appState.get("navigationHistory"),
    });
    expect(second.localRoot.get()).toBe("a");
    second.zoom.forward();
    expect(second.localRoot.get()).toBe("a1");
    second.zoom.back();
    second.zoom.back();
    expect(second.localRoot.get()).toBe(ROOT);
  });

  it("can have unknown nodes", () => {
    const { zoom, localRoot } = setup(SOURCE, {
      zoomedNodeId: "x",
      navigationHistory: { entries: ["y", "a", "x", "b"], index: 2 },
    });
    expect(localRoot.get()).toBe(ROOT);
    zoom.back();
    expect(localRoot.get()).toBe("a");
    expect(zoom.getState().canGoBack).toBe(false);
  });

  it("can be invalid", () => {
    const { zoom, localRoot } = setup(SOURCE, {
      zoomedNodeId: 1,
      navigationHistory: "x",
    } as never);
    expect(localRoot.get()).toBe(ROOT);
    expect(zoom.getState().canGoBack).toBe(false);
  });
});

describe("the scroll position", () => {
  it("survives undo and redo of a collapse", () => {
    const { store, history } = setup();
    store.setCollapsed("a", true);
    history.untracked(() => store.setScrollTop("a", 50));
    history.undo();
    expect(store.getUiState("a")).toEqual({
      nodeId: "a",
      collapsed: false,
      scrollTop: 50,
    });
    history.untracked(() => store.setScrollTop("a", 70));
    history.redo();
    expect(store.getUiState("a")).toEqual({
      nodeId: "a",
      collapsed: true,
      scrollTop: 70,
    });
  });

  it("does not move the cursor of a collapsed local root", () => {
    const { store, zoom, focus, putCursor } = setup();
    store.setCollapsed("a", true);
    zoom.zoomTo("a");
    putCursor("a1", 1);
    store.setScrollTop("a", 50);
    expect(focus.cursor).toEqual(cursorAt("a1", 1));
  });
});

describe("keys in the title", () => {
  it("move between the title and the first child", () => {
    const { editing, zoom } = setup();
    zoom.zoomTo("a");
    expect(editing.moveUp("a1")).toBe(true);
    expect(editing.currentNode.get()).toBe("a");
    expect(editing.moveDown("a")).toBe(true);
    expect(editing.currentNode.get()).toBe("a1");
  });

  it("do not move the local root", () => {
    const { store, editing, zoom } = setup();
    zoom.zoomTo("b");
    const before = snapshot(store);
    editing.indent(cursorAt("b", 0));
    editing.unindent(cursorAt("b", 0));
    editing.mergeIntoUpper("b");
    editing.mergeIntoUpper("b1");
    editing.unindent(cursorAt("b1", 0));
    expect(snapshot(store)).toEqual(before);
  });

  it("enter moves the text after the cursor to a new first child", () => {
    const { store, editing, zoom, focus } = setup();
    zoom.zoomTo("a11");
    zoom.zoomTo("a");
    store.setText("a", "left right");
    editing.enter("a", 5, 5);
    expect(store.getNode("a")?.text).toBe("left ");
    const [firstId] = store.getChildren("a");
    expect(store.getNode(firstId)?.text).toBe("right");
    expect(focus.cursor).toEqual(cursorAt(firstId, 0));
    expect(store.getChildren("a").slice(1)).toEqual(["a1", "a2"]);
  });

  it("enter at the end goes to the empty child", async () => {
    const { store, editing, zoom, focus } = setup();
    zoom.zoomTo("a2");
    await settle();
    editing.enter("a2", 2, 2);
    await settle();
    expect(focus.cursor).toEqual(cursorAt("n1", 0));
    expect(store.getChildren("a2")).toEqual(["n1"]);
  });

  it("enter in an empty title creates a child", () => {
    const { store, editing, zoom } = setup("a\n  b");
    store.setText("a", "");
    zoom.zoomTo("a");
    editing.enter("a", 0, 0);
    expect(dump(store)).toBe(
      outline(`
        ~a
          ~n1
          b
      `),
    );
  });

  it("paste of several lines creates children", () => {
    const { store, editing, zoom } = setup("a\n  b");
    zoom.zoomTo("a");
    editing.paste("a", 1, 1, "x\ny\nz");
    const texts = store.getChildren("a").map((id) => store.getNode(id)?.text);
    expect(store.getNode("a")?.text).toBe("ax");
    expect(texts).toEqual(["y", "z", "b"]);
  });
});
