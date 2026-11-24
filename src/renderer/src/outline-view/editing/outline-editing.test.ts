import { describe, expect, it } from "vitest";
import {
  cursorAt,
  type NodeCursor,
} from "@/renderer/src/outline/editing/cursor";
import {
  createOutline,
  dump,
  ROOT,
  snapshot,
} from "@/renderer/src/outline/fixtures/test-outline";
import { OutlineEditing } from "@/renderer/src/outline-view/editing/outline-editing";
import { LocalRoot } from "@/renderer/src/outline-view/zoom/local-root";

function setup(source: string) {
  const { store } = createOutline(source);
  const editing = new OutlineEditing(store, new LocalRoot(ROOT));
  const { history, focus } = editing;

  function putCursor(cursor: NodeCursor): void {
    editing.currentNode.set(cursor.nodeId);
    focus.setCursor(cursor);
  }

  return { store, editing, history, focus, putCursor };
}

describe("edits", () => {
  it("are one undo step each and move the cursor", () => {
    const { store, editing, history, focus, putCursor } = setup("abc");
    putCursor(cursorAt("abc", 1));
    editing.enter("abc", 1, 1);
    expect(focus.getRequest()).toEqual(cursorAt("n1", 0));
    editing.indent(cursorAt("n1", 0));
    editing.mergeIntoUpper("n1");
    expect(focus.getRequest()).toEqual(cursorAt("abc", 1));
    expect(store.getNode("abc")?.text).toBe("abc");

    history.undo();
    expect(dump(store)).toBe("abc\n  n1");
    expect(focus.getRequest()).toEqual(cursorAt("n1", 0));
    history.undo();
    expect(dump(store)).toBe("abc\nn1");
    history.undo();
    expect(dump(store)).toBe("abc");
    expect(focus.getRequest()).toEqual(cursorAt("abc", 1));
    expect(history.canUndo).toBe(false);
    history.redo();
    expect(focus.getRequest()).toEqual(cursorAt("n1", 0));
  });

  it("change nothing and keep the cursor if the store rejects them", () => {
    const { store, editing, history, focus, putCursor } = setup(`
      a
        b
          ~c
        ~d
    `);
    const before = snapshot(store);
    const cursor = cursorAt("a", 0);
    putCursor(cursor);
    editing.indent(cursor);
    editing.unindent(cursor);
    editing.mergeIntoUpper("a");
    editing.mergeIntoUpper("b");
    expect(snapshot(store)).toEqual(before);
    expect(history.canUndo).toBe(false);
    expect(focus.cursor).toEqual(cursor);
    expect(focus.getRequest()).toEqual(cursor);
  });

  it("paste several lines as one step", () => {
    const { store, editing, history } = setup("a");
    editing.paste("a", 1, 1, "x\n\ny\n");
    expect(store.getNode("a")?.text).toBe("ax");
    expect(store.getNode("n1")?.text).toBe("y");
    history.undo();
    expect(dump(store)).toBe("a");
    expect(store.getNode("a")?.text).toBe("a");
  });
});

describe("moveUp and moveDown", () => {
  it("move to the beginning of the visible node", () => {
    const { editing, focus } = setup(`
      a
        b
    `);
    expect(editing.moveDown("a")).toBe(true);
    expect(focus.getRequest()).toEqual(cursorAt("b", 0));
    expect(editing.moveDown("b")).toBe(false);
    expect(editing.moveUp("b")).toBe(true);
    expect(focus.getRequest()).toEqual(cursorAt("a", 0));
    expect(editing.moveUp("a")).toBe(false);
  });

  it("end the merge of text edits", () => {
    const { store, editing, history } = setup("a\nb");
    store.setText("a", "a1");
    editing.moveDown("a");
    store.setText("a", "a12");
    history.undo();
    expect(store.getNode("a")?.text).toBe("a1");
  });
});

describe("the cursor after undo", () => {
  it("goes to a changed node if its own node is hidden", () => {
    const { store, history, focus, putCursor } = setup(`
      a
        b
      c
    `);
    putCursor(cursorAt("b", 1));
    store.setText("c", "cc");
    history.untracked(() => store.setCollapsed("a", true));
    history.undo();
    expect(focus.getRequest()).toEqual(cursorAt("c", 1));
  });

  it("goes back into a subtree that collapsed over it", () => {
    const { store, editing, history, focus, putCursor } = setup(`
      a
        b
    `);
    putCursor(cursorAt("b", 1));
    store.setCollapsed("a", true);
    expect(editing.currentNode.get()).toBe("a");
    history.undo();
    expect(focus.getRequest()).toEqual(cursorAt("b", 1));
    expect(editing.currentNode.get()).toBe("b");
  });

  it("stays if no node had the cursor", () => {
    const { store, history, focus } = setup("a");
    store.setText("a", "b");
    history.undo();
    expect(focus.getRequest()).toBeNull();
  });
});
