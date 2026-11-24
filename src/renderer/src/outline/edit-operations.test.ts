import { describe, expect, it } from "vitest";
import type { Node } from "@/shared/outline/node";
import { cursorAt, type NodeCursor } from "@/renderer/src/outline/cursor";
import {
  enter,
  indentNode,
  mergeIntoUpper,
  pasteLines,
  splitLines,
  unindentNode,
  type EditContext,
} from "@/renderer/src/outline/edit-operations";
import { OutlineError } from "@/renderer/src/outline/errors";
import { OutlineStore } from "@/renderer/src/outline/store";
import {
  CREATED_AT,
  createOutline,
  dump,
  outline,
  ROOT,
  snapshot,
  testNode,
} from "@/renderer/src/outline/test-outline";
import { UndoHistory } from "@/renderer/src/outline/undo";

function setup(source: string, rootId = ROOT) {
  const { store, clock } = createOutline(source);
  clock.now = 3000;
  return { ...contextOf(store, rootId), clock };
}

function contextOf(store: OutlineStore, rootId = ROOT) {
  const context: EditContext = { store, rootId };
  const history = new UndoHistory(store);

  /** Runs the edit as one step; checks that undo and redo restore everything. */
  function run(
    edit: (context: EditContext) => NodeCursor | null,
  ): NodeCursor | null {
    history.clear();
    const before = snapshot(store);
    const cursor = history.transaction(() => edit(context));
    const after = snapshot(store);
    if (history.undo() !== null) {
      expect(snapshot(store)).toEqual(before);
      expect(history.canUndo).toBe(false);
      history.redo();
      expect(snapshot(store)).toEqual(after);
    }
    return cursor;
  }

  function expectUnchanged(
    edit: (context: EditContext) => NodeCursor | null,
  ): void {
    const before = snapshot(store);
    expect(run(edit)).toBeNull();
    expect(snapshot(store)).toEqual(before);
  }

  function expectRejectedEdit(
    edit: (context: EditContext) => NodeCursor | null,
  ): void {
    history.clear();
    const before = snapshot(store);
    expect(() => history.transaction(() => edit(context))).toThrow(
      OutlineError,
    );
    expect(snapshot(store)).toEqual(before);
    expect(history.canUndo).toBe(false);
  }

  function node(id: string): Node {
    return store.getNode(id) as Node;
  }

  return { store, run, expectUnchanged, expectRejectedEdit, node };
}

function enterAt(id: string, from: number, to = from) {
  return (context: EditContext) => enter(context, id, from, to);
}

describe("enter at the end of the text", () => {
  it("creates an empty sibling below", () => {
    const { store, run, node } = setup(`
      a
      b
    `);
    expect(run(enterAt("a", 1))).toEqual(cursorAt("n1", 0));
    expect(dump(store)).toBe(
      outline(`
        a
        ~n1
        b
      `),
    );
    expect(node("n1").format).toBe("bullet");
  });

  it("creates a first child of a node with expanded children", () => {
    const { store, run } = setup(`
      a
        b
      c
    `);
    expect(run(enterAt("a", 1))).toEqual(cursorAt("n1", 0));
    expect(dump(store)).toBe(
      outline(`
        a
          ~n1
          b
        c
      `),
    );
  });

  it("creates a sibling below a node with collapsed children", () => {
    const { store, run } = setup(`
      a
        b
      c
    `);
    store.setCollapsed("a", true);
    run(enterAt("a", 1));
    expect(store.getChildren(ROOT)).toEqual(["a", "n1", "c"]);
  });

  it("creates a not completed sibling below a completed node", () => {
    const { store, run, node } = setup("a");
    store.setCompleted(["a"], true);
    run(enterAt("a", 1));
    expect(node("n1").completedAt).toBeNull();
  });

  it("creates a sibling below a node that has only a note", () => {
    const { store, run } = setup("~a");
    store.setNote("a", "note");
    expect(run(enterAt("a", 0))).toEqual(cursorAt("n1", 0));
    expect(store.getChildren(ROOT)).toEqual(["a", "n1"]);
  });

  it("goes to the next sibling if it is empty and the last one", () => {
    const { store, run } = setup(`
      a
      ~b
    `);
    expect(run(enterAt("a", 1))).toEqual(cursorAt("b", 0));
    expect(dump(store)).toBe("a\n~b");
  });

  it("goes to the only child if it is empty", () => {
    const { store, run } = setup(`
      a
        ~b
    `);
    expect(run(enterAt("a", 1))).toEqual(cursorAt("b", 0));
    expect(dump(store)).toBe("a\n  ~b");
  });

  it("creates a sibling before an empty one that is not the last", () => {
    const { store, run } = setup(`
      a
      ~b
      c
    `);
    expect(run(enterAt("a", 1))).toEqual(cursorAt("n1", 0));
    expect(store.getChildren(ROOT)).toEqual(["a", "n1", "b", "c"]);
  });

  it("creates a sibling before a last one that has only a note", () => {
    const { store, run } = setup(`
      a
      ~b
    `);
    store.setNote("b", "note");
    run(enterAt("a", 1));
    expect(store.getChildren(ROOT)).toEqual(["a", "n1", "b"]);
  });
});

describe("enter at the beginning of the text", () => {
  it("creates an empty sibling above", () => {
    const { store, run, node } = setup(`
      a
      b
        c
    `);
    const original = node("b");
    expect(run(enterAt("b", 0))).toEqual(cursorAt("b", 0));
    expect(dump(store)).toBe(
      outline(`
        a
        ~n1
        b
          c
      `),
    );
    expect(node("b")).toBe(original);
  });

  it("creates the first child of the parent", () => {
    const { store, run } = setup(`
      a
        b
    `);
    run(enterAt("b", 0));
    expect(store.getChildren("a")).toEqual(["n1", "b"]);
  });

  it("allows two empty siblings before the node", () => {
    const { store, run } = setup(`
      ~a
      b
    `);
    run(enterAt("b", 0));
    expect(store.getChildren(ROOT)).toEqual(["a", "n1", "b"]);
  });
});

describe("enter in the middle of the text", () => {
  it("moves the text after the cursor and the children to a sibling below", () => {
    const { store, run, node } = setup(`
      abc
        child
      d
    `);
    store.setFormat("abc", "h1");
    store.setNote("abc", "note");
    store.setAttribute("abc", "k", 1);
    expect(run(enterAt("abc", 1))).toEqual(cursorAt("n1", 0));
    expect(dump(store)).toBe(
      outline(`
        abc
        n1
          child
        d
      `),
    );
    expect(node("abc")).toMatchObject({
      text: "a",
      format: "h1",
      note: "note",
      attributes: { k: 1 },
      createdAt: CREATED_AT,
    });
    expect(node("n1")).toMatchObject({
      text: "bc",
      format: "bullet",
      note: "",
      createdAt: 3000,
    });
    expect(node("n1").attributes).toBeUndefined();
  });

  it("keeps collapsed children collapsed", () => {
    const { store, run } = setup(`
      abc
        child
    `);
    store.setCollapsed("abc", true);
    run(enterAt("abc", 1));
    expect(dump(store)).toBe("abc\nn1\n  child");
    expect(store.getUiState("n1")?.collapsed).toBe(true);
    expect(store.getUiState("abc")?.collapsed).toBe(false);
  });

  it("moves children that are empty", () => {
    const { store, run } = setup(`
      abc
        ~b
        ~c
        d
    `);
    store.setText("d", "");
    run(enterAt("abc", 1));
    expect(store.getChildren("n1")).toEqual(["b", "c", "d"]);
  });
});

describe("enter with selected text", () => {
  it("deletes the selected text and splits", () => {
    const { run, node } = setup("abcd");
    expect(run(enterAt("abcd", 1, 3))).toEqual(cursorAt("n1", 0));
    expect(node("abcd").text).toBe("a");
    expect(node("n1").text).toBe("d");
  });

  it("deletes the selected end and creates a sibling below", () => {
    const { store, run, node } = setup("abcd");
    run(enterAt("abcd", 2, 4));
    expect(node("abcd").text).toBe("ab");
    expect(dump(store)).toBe("abcd\n~n1");
  });

  it("deletes the selected beginning and creates a sibling above", () => {
    const { store, run, node } = setup("abcd");
    expect(run(enterAt("abcd", 0, 2))).toEqual(cursorAt("abcd", 0));
    expect(node("abcd").text).toBe("cd");
    expect(store.getChildren(ROOT)).toEqual(["n1", "abcd"]);
  });

  it("only deletes the text if all of it is selected", () => {
    const { store, run } = setup(`
      a
        bc
    `);
    expect(run(enterAt("bc", 0, 2))).toEqual(cursorAt("bc", 0));
    expect(dump(store)).toBe("a\n  ~bc");
  });

  it("deletes the selected end and goes to the empty last sibling", () => {
    const { store, run, node } = setup(`
      abc
      ~d
    `);
    expect(run(enterAt("abc", 1, 3))).toEqual(cursorAt("d", 0));
    expect(node("abc").text).toBe("a");
    expect(store.getChildren(ROOT)).toEqual(["abc", "d"]);
  });
});

describe("the format of a new node", () => {
  const cases: [string, string, number, string][] = [
    ["at the end", "abc", 3, "abc"],
    ["at the beginning", "abc", 0, "abc"],
    ["in the middle", "abc", 1, "abc"],
    ["in an empty node", "", 0, "abc"],
  ];

  for (const [name, text, offset, id] of cases) {
    it(`continues a paragraph, but not a heading, ${name}`, () => {
      for (const format of ["paragraph", "h1"] as const) {
        const { store, run, node } = setup(`
          abc
          d
        `);
        store.setFormat(id, format);
        store.setText(id, text);
        run(enterAt(id, offset));
        expect(node("n1").format).toBe(
          format === "paragraph" ? "paragraph" : "bullet",
        );
        expect(node(id).format).toBe(format);
      }
    });
  }

  it("continues a paragraph in its new first child", () => {
    const { store, run, node } = setup(`
      a
        b
    `);
    store.setFormat("a", "paragraph");
    run(enterAt("a", 1));
    expect(node("n1")).toMatchObject({ parentId: "a", format: "paragraph" });
  });
});

describe("enter in an empty node", () => {
  it("unindents the last child with its children", () => {
    const { store, run } = setup(`
      a
        b
        ~c
          d
      e
    `);
    expect(run(enterAt("c", 0))).toEqual(cursorAt("c", 0));
    expect(dump(store)).toBe(
      outline(`
        a
          b
        ~c
          d
        e
      `),
    );
  });

  it("creates a sibling below if the node is not the last child", () => {
    const { store, run } = setup(`
      a
        ~b
        c
    `);
    expect(run(enterAt("b", 0))).toEqual(cursorAt("n1", 0));
    expect(store.getChildren("a")).toEqual(["b", "n1", "c"]);
  });

  it("does nothing in the last child of the global root", () => {
    const { expectUnchanged } = setup(`
      a
      ~b
    `);
    expectUnchanged(enterAt("b", 0));
  });

  it("does nothing in the last child of the local root", () => {
    const { expectUnchanged } = setup(
      `
      a
        b
          c
          ~d
      `,
      "b",
    );
    expectUnchanged(enterAt("d", 0));
  });

  it("is rejected if the unindent would leave two empty children at the end", () => {
    const { expectRejectedEdit } = setup(`
      a
        b
          ~c
        ~d
    `);
    expectRejectedEdit(enterAt("c", 0));
  });
});

describe("mergeIntoUpper", () => {
  function merge(id: string) {
    return (context: EditContext) => mergeIntoUpper(context, id);
  }

  it("appends the text, note, attributes and children to the upper node", () => {
    const { store, run, node } = setup(`
      a
      b
        b1
        b2
      c
    `);
    store.setFormat("a", "h1");
    store.setNote("a", "note a");
    store.setNote("b", "note b");
    store.setAttribute("a", "x", "a");
    store.setAttribute("b", "x", "b");
    store.setAttribute("b", "y", [1]);
    expect(run(merge("b"))).toEqual(cursorAt("a", 1));
    expect(dump(store)).toBe(
      outline(`
        a
          b1
          b2
        c
      `),
    );
    expect(node("a")).toMatchObject({
      text: "ab",
      format: "h1",
      note: "note a\nnote b",
      attributes: { x: "a", y: [1] },
      createdAt: CREATED_AT,
    });
  });

  it("takes the note of the merged node if the upper node has none", () => {
    const { store, run, node } = setup(`
      a
      b
    `);
    store.setNote("b", "note b");
    run(merge("b"));
    expect(node("a").note).toBe("note b");
  });

  it("merges into the last visible descendant of the previous sibling", () => {
    const { store, run, node } = setup(`
      a
        a1
          a2
      b
    `);
    expect(run(merge("b"))).toEqual(cursorAt("a2", 2));
    expect(dump(store)).toBe("a\n  a1\n    a2");
    expect(node("a2").text).toBe("a2b");
  });

  it("merges the first child into its parent", () => {
    const { store, run, node } = setup(`
      a
        b
          c
        d
    `);
    expect(run(merge("b"))).toEqual(cursorAt("a", 1));
    expect(dump(store)).toBe(
      outline(`
        a
          d
          c
      `),
    );
    expect(node("a").text).toBe("ab");
  });

  it("removes an empty node", () => {
    const { store, run, node } = setup(`
      a
      ~b
      c
    `);
    const original = node("a");
    expect(run(merge("b"))).toEqual(cursorAt("a", 1));
    expect(store.getChildren(ROOT)).toEqual(["a", "c"]);
    expect(node("a")).toBe(original);
  });

  it("keeps an empty upper node", () => {
    const { store, run, node } = setup(`
      ~a
      b
    `);
    expect(run(merge("b"))).toEqual(cursorAt("a", 0));
    expect(store.getChildren(ROOT)).toEqual(["a"]);
    expect(node("a").text).toBe("b");
  });

  it("does nothing if the node and the previous sibling have children", () => {
    const { store, expectUnchanged } = setup(`
      a
        a1
      b
        b1
    `);
    expectUnchanged(merge("b"));
    store.setCollapsed("a", true);
    expectUnchanged(merge("b"));
    store.setCollapsed("b", true);
    expectUnchanged(merge("b"));
  });

  it("does nothing if the node has collapsed children", () => {
    const { store, expectUnchanged } = setup(`
      a
      b
        b1
    `);
    store.setCollapsed("b", true);
    expectUnchanged(merge("b"));
  });

  it("is the opposite of a split of a node with expanded children", () => {
    const { store, run } = setup(`
      abc
        child
    `);
    run(enterAt("abc", 1));
    expect(run(merge("n1"))).toEqual(cursorAt("abc", 1));
    expect(dump(store)).toBe("abc\n  child");
    expect(store.getNode("abc")?.text).toBe("abc");
  });

  it("shows the children below an upper node that was collapsed before it lost its own", () => {
    const { store, run } = setup(`
      a
        a1
      b
        b1
    `);
    store.setCollapsed("a", true);
    store.deleteNode("a1");
    run(merge("b"));
    expect(store.getUiState("a")?.collapsed).toBe(false);
  });

  it("keeps a collapsed upper node if the merged node has no children", () => {
    const { store, run } = setup(`
      a
        a1
      b
    `);
    store.setCollapsed("a", true);
    run(merge("b"));
    expect(store.getUiState("a")?.collapsed).toBe(true);
  });

  it("does nothing in the first visible node", () => {
    const { expectUnchanged } = setup("a");
    expectUnchanged(merge("a"));
  });

  it("does nothing in the first child of the local root", () => {
    const { expectUnchanged } = setup(
      `
      a
        b
      `,
      "a",
    );
    expectUnchanged(merge("b"));
  });

  it("is rejected if the parent would end with two empty children", () => {
    const { expectRejectedEdit } = setup(`
      a
        b
          ~c
        ~d
    `);
    expectRejectedEdit(merge("b"));
  });

  it("does nothing below a divider or an attachment", () => {
    const { store } = OutlineStore.load({
      nodes: [
        testNode(ROOT, null, "a0"),
        { ...testNode("a", ROOT, "a0", ""), type: "attachment" },
        testNode("b", ROOT, "a1"),
        { ...testNode("c", ROOT, "a2", ""), format: "divider" },
        testNode("d", ROOT, "a3"),
      ],
    });
    const { expectUnchanged } = contextOf(store);
    expectUnchanged(merge("b"));
    expectUnchanged(merge("c"));
    expectUnchanged(merge("d"));
  });
});

describe("indentNode and unindentNode", () => {
  it("indents and keeps the cursor", () => {
    const { store, run } = setup(`
      a
      bcd
    `);
    const cursor = { nodeId: "bcd", anchor: 1, head: 2 };
    expect(run((context) => indentNode(context, cursor))).toEqual(cursor);
    expect(dump(store)).toBe("a\n  bcd");
  });

  it("expands a collapsed new parent", () => {
    const { store, run } = setup(`
      a
        b
      c
    `);
    store.setCollapsed("a", true);
    run((context) => indentNode(context, cursorAt("c", 0)));
    expect(store.getUiState("a")?.collapsed).toBe(false);
  });

  it("rejects the indent of a first child", () => {
    const { expectRejectedEdit } = setup("a");
    expectRejectedEdit((context) => indentNode(context, cursorAt("a", 0)));
  });

  it("rejects the indent below an empty last child", () => {
    const { expectRejectedEdit } = setup(`
      a
        ~b
      ~c
    `);
    expectRejectedEdit((context) => indentNode(context, cursorAt("c", 0)));
  });

  it("unindents and keeps the cursor", () => {
    const { store, run } = setup(`
      a
        b
        c
    `);
    expect(run((context) => unindentNode(context, cursorAt("b", 1)))).toEqual(
      cursorAt("b", 1),
    );
    expect(dump(store)).toBe("a\n  c\nb");
  });

  it("does not unindent a child of the global or the local root", () => {
    const source = `
      a
        b
          c
    `;
    setup(source).expectUnchanged((context) =>
      unindentNode(context, cursorAt("a", 0)),
    );
    setup(source, "b").expectUnchanged((context) =>
      unindentNode(context, cursorAt("c", 0)),
    );
  });

  it("rejects an unindent that leaves two empty children at the end", () => {
    const { store, expectRejectedEdit } = setup(`
      a
        ~b
        ~c
        d
    `);
    expect(store.getChildren("a")).toHaveLength(3);
    expectRejectedEdit((context) => unindentNode(context, cursorAt("d", 0)));
  });
});

describe("splitLines", () => {
  it("accepts all line breaks and drops blank lines", () => {
    expect(splitLines("a\nb\r\nc\rd")).toEqual(["a", "b", "c", "d"]);
    expect(splitLines("\na\n\n  \nb\n")).toEqual(["a", "b"]);
    expect(splitLines("\n\n")).toEqual([]);
  });
});

describe("pasteLines", () => {
  function paste(id: string, from: number, to: number, lines: string[]) {
    return (context: EditContext) => pasteLines(context, id, from, to, lines);
  }

  it("splits the node and moves the children to the last line", () => {
    const { store, run, node } = setup(`
      abcd
        child
      e
    `);
    expect(run(paste("abcd", 1, 3, ["x", "y", "zz"]))).toEqual(
      cursorAt("n2", 2),
    );
    expect(dump(store)).toBe(
      outline(`
        abcd
        n1
        n2
          child
        e
      `),
    );
    expect(node("abcd").text).toBe("ax");
    expect(node("n1").text).toBe("y");
    expect(node("n2").text).toBe("zzd");
  });

  it("moves the children to the last line at the beginning of the text", () => {
    const { store, run, node } = setup(`
      a
        child
    `);
    run(paste("a", 0, 0, ["x", "y"]));
    expect(dump(store)).toBe("a\nn1\n  child");
    expect(node("a").text).toBe("x");
    expect(node("n1").text).toBe("ya");
  });

  it("creates first children at the end of a node with expanded children", () => {
    const { store, run, node } = setup(`
      a
        child
    `);
    expect(run(paste("a", 1, 1, ["x", "y", "z"]))).toEqual(cursorAt("n2", 1));
    expect(dump(store)).toBe("a\n  n1\n  n2\n  child");
    expect(node("a").text).toBe("ax");
    expect(node("n2").text).toBe("z");
  });

  it("creates siblings at the end of a node with collapsed children", () => {
    const { store, run } = setup(`
      a
        child
      b
    `);
    store.setCollapsed("a", true);
    run(paste("a", 1, 1, ["x", "y", "z"]));
    expect(dump(store)).toBe("a\n  child\nn1\nn2\nb");
  });

  it("fills an empty last sibling", () => {
    const { store, run, node } = setup(`
      a
      ~b
    `);
    run(paste("a", 1, 1, ["x", "y"]));
    expect(store.getChildren(ROOT)).toEqual(["a", "b"]);
    expect(node("b").text).toBe("y");
  });

  it("fills an empty node", () => {
    const { store, run, node } = setup("~a");
    run(paste("a", 0, 0, ["x", "y"]));
    expect(dump(store)).toBe("a\nn1");
    expect(node("a").text).toBe("x");
  });

  it("continues a paragraph", () => {
    const { store, run, node } = setup("a");
    store.setFormat("a", "paragraph");
    run(paste("a", 1, 1, ["x", "y"]));
    expect(node("n1").format).toBe("paragraph");
  });

  it("inserts a single line into the text", () => {
    const { store, run, node } = setup("abcd");
    expect(run(paste("abcd", 1, 3, ["xyz"]))).toEqual(cursorAt("abcd", 4));
    expect(node("abcd").text).toBe("axyzd");
    expect(store.getChildren(ROOT)).toEqual(["abcd"]);
  });

  it("does nothing without lines", () => {
    const { expectUnchanged } = setup("abcd");
    expectUnchanged(paste("abcd", 1, 3, []));
  });

  it("is rejected in an attachment", () => {
    const { store } = OutlineStore.load({
      nodes: [
        testNode(ROOT, null, "a0"),
        { ...testNode("a", ROOT, "a0", ""), type: "attachment" },
      ],
    });
    contextOf(store).expectRejectedEdit(paste("a", 0, 0, ["x", "y"]));
  });
});
