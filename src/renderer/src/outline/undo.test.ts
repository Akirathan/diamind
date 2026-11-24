import { describe, expect, it } from "vitest";
import type { ChangeSet } from "@/shared/outline/change-set";
import type { OutlineEvent, OutlineStore } from "@/renderer/src/outline/store";
import {
  createOutline,
  dump,
  outline,
  snapshot,
  ROOT,
} from "@/renderer/src/outline/test-outline";
import {
  MAX_UNDO_STEPS,
  MERGE_PAUSE_MS,
  UndoHistory,
} from "@/renderer/src/outline/undo";

function setup(source: string) {
  const { store, clock } = createOutline(source);
  const history = new UndoHistory(store, { now: () => clock.now });
  return { store, clock, history };
}

const source = `
  a
    b
      c
  d
    e
`;

describe("each command", () => {
  const commands: [string, (store: OutlineStore) => unknown][] = [
    ["insertNode", (store) => store.insertNode("a", "b")],
    ["setText", (store) => store.setText("a", "x")],
    ["setNote", (store) => store.setNote("a", "x")],
    ["setFormat", (store) => store.setFormat("a", "h1")],
    ["setCompleted", (store) => store.setCompleted(["a", "e"], true)],
    ["setCollapsed", (store) => store.setCollapsed("a", true)],
    ["indent", (store) => store.indent("d")],
    ["unindent", (store) => store.unindent("c")],
    ["move", (store) => store.move("b", "d", "e")],
    ["deleteNode", (store) => store.deleteNode("a")],
    ["setAttribute", (store) => store.setAttribute("a", "k", { x: [1] })],
    ["removeAttribute", (store) => store.removeAttribute("b", "k")],
  ];

  for (const [name, run] of commands) {
    it(`undoes and redoes ${name}`, () => {
      const { store, clock, history } = setup(source);
      store.setAttribute("b", "k", 1);
      store.setCollapsed("b", true);
      history.clear();
      clock.now = 5000;
      const before = snapshot(store);
      const sizeBefore = store.size;
      run(store);
      const after = snapshot(store);
      const sizeAfter = store.size;
      expect(after).not.toEqual(before);

      clock.now = 6000;
      expect(history.undo()).not.toBeNull();
      expect(snapshot(store)).toEqual(before);
      expect(store.size).toBe(sizeBefore);

      expect(history.redo()).not.toBeNull();
      expect(snapshot(store)).toEqual(after);
      expect(store.size).toBe(sizeAfter);

      history.undo();
      expect(snapshot(store)).toEqual(before);
    });
  }
});

describe("undo and redo", () => {
  it("returns null if there is nothing to undo or redo", () => {
    const { store, history } = setup(source);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.undo()).toBeNull();
    expect(history.redo()).toBeNull();
    expect(dump(store)).toBe(outline(source));
  });

  it("updates canUndo and canRedo", () => {
    const { store, history } = setup(source);
    store.setText("a", "x");
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
    history.undo();
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);
    history.redo();
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
  });

  it("undoes several steps in reverse order", () => {
    const { store, history } = setup(source);
    store.indent("d");
    store.setText("e", "x");
    history.undo();
    expect(store.getNode("e")?.text).toBe("e");
    expect(store.getNode("d")?.parentId).toBe("a");
    history.undo();
    expect(dump(store)).toBe(outline(source));
  });

  it("returns a change set and notifies subscribers", () => {
    const { store, history } = setup(source);
    store.setText("a", "x");
    const events: OutlineEvent[] = [];
    store.subscribe((event) => events.push(event));

    const undone = history.undo() as ChangeSet;
    expect(undone.nodes.upsert).toEqual([store.getNode("a")]);
    expect(undone.nodes.upsert[0].text).toBe("a");
    expect(undone.nodes.before[0].text).toBe("x");
    expect(events).toHaveLength(1);
    expect(events[0].changes).toBe(undone);
    expect([...events[0].changedIds]).toEqual(["a"]);

    const redone = history.redo() as ChangeSet;
    expect(redone.nodes.upsert[0].text).toBe("x");
    expect(events).toHaveLength(2);
  });

  it("restores the exact previous row", () => {
    const { store, clock, history } = setup(source);
    const original = store.getNode("d");
    clock.now = 9000;
    store.move("d", "a", null);
    history.undo();
    expect(store.getNode("d")).toBe(original);
    expect(store.getChildren(ROOT)).toEqual(["a", "d"]);
  });

  it("brings back a deleted subtree with ids, rows and UI state", () => {
    const { store, history } = setup(source);
    store.setCollapsed("b", true);
    store.setNote("c", "note");
    history.clear();
    const before = snapshot(store);
    const rows = ["a", "b", "c"].map((id) => store.getNode(id));
    const changes = store.deleteNode("a");
    expect(changes.uiState.delete).toEqual(["b"]);

    const undone = history.undo() as ChangeSet;
    expect(snapshot(store)).toEqual(before);
    expect(["a", "b", "c"].map((id) => store.getNode(id))).toEqual(rows);
    expect(store.getUiState("b")?.collapsed).toBe(true);
    expect(undone.nodes.upsert.map((node) => node.id).sort()).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(undone.uiState.upsert).toEqual([store.getUiState("b")]);

    history.redo();
    expect(store.getNode("a")).toBeUndefined();
    expect(store.getUiState("b")).toBeUndefined();
  });

  it("collapses again the parent that indent expanded", () => {
    const { store, history } = setup(source);
    store.setCollapsed("a", true);
    store.indent("d");
    expect(store.getUiState("a")?.collapsed).toBe(false);
    history.undo();
    expect(store.getUiState("a")?.collapsed).toBe(true);
    expect(store.getNode("d")?.parentId).toBe(ROOT);
    history.redo();
    expect(store.getUiState("a")?.collapsed).toBe(false);
    expect(store.getNode("d")?.parentId).toBe("a");
  });

  it("removes an inserted node on undo and brings it back on redo", () => {
    const { store, history } = setup(source);
    const { id } = store.insertNode("a", null, "h2", { text: "new" });
    const inserted = store.getNode(id);
    history.undo();
    expect(store.getNode(id)).toBeUndefined();
    history.redo();
    expect(store.getNode(id)).toBe(inserted);
    expect(store.getChildren("a")).toEqual([id, "b"]);
  });

  it("stops after dispose", () => {
    const { store, history } = setup(source);
    history.dispose();
    store.setText("a", "x");
    expect(history.canUndo).toBe(false);
  });
});

describe("redo stack", () => {
  it("is cleared by a new command", () => {
    const { store, history } = setup(source);
    store.setText("a", "x");
    history.undo();
    store.setFormat("d", "h1");
    expect(history.canRedo).toBe(false);
    expect(history.redo()).toBeNull();
  });

  it("is kept by a command that changes nothing", () => {
    const { store, history } = setup(source);
    store.setText("a", "x");
    history.undo();
    store.setText("a", "a");
    expect(history.canRedo).toBe(true);
  });

  it("is kept by a rejected command", () => {
    const { store, history } = setup(source);
    store.setText("a", "x");
    history.undo();
    expect(() => store.indent("a")).toThrow();
    expect(history.canRedo).toBe(true);
  });
});

describe("transaction", () => {
  it("undoes several commands as one step", () => {
    const { store, history } = setup(`
      a
      b
      c
    `);
    store.setCollapsed("a", true);
    history.clear();
    history.transaction(() => {
      store.indent("b");
      store.indent("c");
    });
    expect(dump(store)).toBe(
      outline(`
      a
        b
        c
    `),
    );
    history.undo();
    expect(dump(store)).toBe(
      outline(`
      a
      b
      c
    `),
    );
    expect(store.getUiState("a")?.collapsed).toBe(true);
    expect(history.canUndo).toBe(false);
    history.redo();
    expect(store.getChildren("a")).toEqual(["b", "c"]);
  });

  it("returns the result of the callback", () => {
    const { store, history } = setup(source);
    const id = history.transaction(() => store.insertNode("a", null).id);
    expect(store.getNode(id)).toBeDefined();
  });

  it("merges nested transactions into the outer one", () => {
    const { store, history } = setup(source);
    history.transaction(() => {
      store.setText("a", "x");
      history.transaction(() => {
        store.setText("d", "y");
      });
      store.setText("e", "z");
    });
    history.undo();
    expect(dump(store)).toBe(outline(source));
    expect(history.canUndo).toBe(false);
  });

  it("adds no step if nothing changed", () => {
    const { store, history } = setup(source);
    store.setText("a", "x");
    history.undo();
    history.transaction(() => {
      store.setText("d", "d");
    });
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);
  });

  it("adds no step if the changes cancel out", () => {
    const { store, history } = setup(source);
    history.transaction(() => {
      const { id } = store.insertNode("a", null);
      store.deleteNode(id);
    });
    expect(history.canUndo).toBe(false);
  });

  it("keeps the commands that succeeded before a throw", () => {
    const { store, history } = setup(source);
    expect(() =>
      history.transaction(() => {
        store.setText("a", "x");
        store.indent("a");
      }),
    ).toThrow();
    expect(store.getNode("a")?.text).toBe("x");
    history.undo();
    expect(store.getNode("a")?.text).toBe("a");
    expect(history.canUndo).toBe(false);
  });

  it("does not allow undo or redo inside", () => {
    const { store, history } = setup(source);
    store.setText("a", "x");
    expect(() => history.transaction(() => history.undo())).toThrow();
    expect(store.getNode("a")?.text).toBe("x");
  });

  it("does not merge with a following text edit", () => {
    const { store, history } = setup(source);
    history.transaction(() => {
      store.setText("a", "x");
    });
    store.setText("a", "xy");
    history.undo();
    expect(store.getNode("a")?.text).toBe("x");
  });
});

describe("step limit", () => {
  function undoAll(history: UndoHistory): number {
    let count = 0;
    while (history.undo() !== null) {
      count++;
    }
    return count;
  }

  it("drops the oldest steps above the default limit", () => {
    const { store, history } = setup(source);
    for (let i = 1; i <= MAX_UNDO_STEPS + 2; i++) {
      store.setText("a", `a${i}`);
      history.breakMerge();
    }
    expect(undoAll(history)).toBe(MAX_UNDO_STEPS);
    expect(store.getNode("a")?.text).toBe("a2");
  });

  it("keeps all steps through undo and redo at the limit", () => {
    const { store, clock } = createOutline(source);
    const history = new UndoHistory(store, {
      now: () => clock.now,
      maxSteps: 2,
    });
    store.setFormat("a", "h1");
    store.setFormat("a", "h2");
    store.setFormat("a", "h3");
    expect(undoAll(history)).toBe(2);
    expect(store.getNode("a")?.format).toBe("h1");
    history.redo();
    history.redo();
    expect(history.canRedo).toBe(false);
    expect(store.getNode("a")?.format).toBe("h3");
    expect(undoAll(history)).toBe(2);
  });

  it("counts merged edits and a transaction as one step each", () => {
    const { store, clock } = createOutline(source);
    const history = new UndoHistory(store, {
      now: () => clock.now,
      maxSteps: 2,
    });
    history.transaction(() => {
      store.setFormat("a", "h1");
      store.setFormat("d", "h1");
    });
    store.setText("a", "a1");
    store.setText("a", "a12");
    store.setText("a", "a123");
    expect(undoAll(history)).toBe(2);
    expect(dump(store)).toBe(outline(source));
    expect(store.getNode("d")?.format).toBe("bullet");
  });
});

describe("text merging", () => {
  it("merges consecutive edits of the same text", () => {
    const { store, clock, history } = setup(source);
    store.setText("a", "a1");
    clock.now += 500;
    store.setText("a", "a12");
    clock.now += 500;
    store.setText("a", "a123");
    history.undo();
    expect(store.getNode("a")?.text).toBe("a");
    expect(history.canUndo).toBe(false);
    history.redo();
    expect(store.getNode("a")?.text).toBe("a123");
  });

  it("starts a new step after a pause", () => {
    const { store, clock, history } = setup(source);
    store.setText("a", "a1");
    clock.now += MERGE_PAUSE_MS;
    store.setText("a", "a12");
    history.undo();
    expect(store.getNode("a")?.text).toBe("a1");
    history.undo();
    expect(store.getNode("a")?.text).toBe("a");
  });

  it("measures the pause from the last edit", () => {
    const { store, clock, history } = setup(source);
    for (let i = 1; i <= 5; i++) {
      clock.now += MERGE_PAUSE_MS - 1;
      store.setText("a", `a${i}`);
    }
    history.undo();
    expect(store.getNode("a")?.text).toBe("a");
  });

  it("accepts a custom pause", () => {
    const { store, clock } = createOutline(source);
    const history = new UndoHistory(store, {
      now: () => clock.now,
      mergePauseMs: 100,
    });
    store.setText("a", "a1");
    clock.now += 100;
    store.setText("a", "a12");
    history.undo();
    expect(store.getNode("a")?.text).toBe("a1");
  });

  it("starts a new step after breakMerge", () => {
    const { store, history } = setup(source);
    store.setText("a", "a1");
    history.breakMerge();
    store.setText("a", "a12");
    store.setText("a", "a123");
    history.undo();
    expect(store.getNode("a")?.text).toBe("a1");
    history.undo();
    expect(store.getNode("a")?.text).toBe("a");
  });

  it("does not merge edits of different nodes", () => {
    const { store, history } = setup(source);
    store.setText("a", "x");
    store.setText("d", "y");
    history.undo();
    expect(store.getNode("a")?.text).toBe("x");
    expect(store.getNode("d")?.text).toBe("d");
  });

  it("does not merge across another command", () => {
    const { store, history } = setup(source);
    store.setText("a", "x");
    store.setFormat("a", "h1");
    store.setText("a", "xy");
    history.undo();
    expect(store.getNode("a")?.text).toBe("x");
    expect(store.getNode("a")?.format).toBe("h1");
  });

  it("merges consecutive edits of the same note", () => {
    const { store, history } = setup(source);
    store.setNote("a", "n");
    store.setNote("a", "no");
    history.undo();
    expect(store.getNode("a")?.note).toBe("");
    expect(history.canUndo).toBe(false);
  });

  it("does not merge a text edit with a note edit", () => {
    const { store, history } = setup(source);
    store.setText("a", "x");
    store.setNote("a", "n");
    history.undo();
    expect(store.getNode("a")?.text).toBe("x");
    expect(store.getNode("a")?.note).toBe("");
  });

  it("does not merge into a step before an undo", () => {
    const { store, history } = setup(source);
    store.setText("a", "x");
    store.setText("d", "y");
    history.undo();
    store.setText("a", "xz");
    history.undo();
    expect(store.getNode("a")?.text).toBe("x");
  });

  it("does not merge into a step after a redo", () => {
    const { store, history } = setup(source);
    store.setText("a", "x");
    history.undo();
    history.redo();
    store.setText("a", "xy");
    history.undo();
    expect(store.getNode("a")?.text).toBe("x");
  });

  it("restores the modifiedAt of the first edit", () => {
    const { store, clock, history } = setup(source);
    const original = store.getNode("a");
    store.setText("a", "a1");
    clock.now += 100;
    store.setText("a", "a12");
    history.undo();
    expect(store.getNode("a")).toBe(original);
  });
});
