import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  emptyChangeSet,
  type ChangeSet,
} from "../../shared/outline/change-set";
import type { Node } from "../../shared/outline/node";
import type { Db } from "./database";
import { applyChangeSet, loadOutline } from "./outline";
import { openTestDatabase, testNode } from "./test-db";

let db: Db;

beforeEach(() => {
  db = openTestDatabase();
});

afterEach(() => {
  db.$client.close();
});

function upsertNodes(...nodes: Node[]): ChangeSet {
  const changes = emptyChangeSet();
  changes.nodes.upsert.push(...nodes);
  return changes;
}

describe("loadOutline", () => {
  it("returns nothing for an empty database", () => {
    expect(loadOutline(db)).toEqual({ nodes: [], uiState: [] });
  });

  it("round-trips every node field", () => {
    const node = testNode("n1", {
      parentId: "root",
      sortKey: "a1V",
      type: "attachment",
      format: "h2",
      text: "Text with 'quotes' and ünïcode",
      note: "line 1\nline 2",
      completedAt: 1_700_000_000_123,
      attachmentId: "att1",
      attributes: {
        status: "done",
        count: 3,
        ratio: 0.5,
        flag: false,
        empty: null,
        list: [1, "two", { three: 3 }],
        nested: { deep: { deeper: [true] } },
      },
      createdAt: 1_600_000_000_000,
      modifiedAt: 1_650_000_000_000,
    });
    applyChangeSet(db, upsertNodes(node));
    expect(loadOutline(db).nodes).toEqual([node]);
  });

  it("keeps null fields and leaves out absent attributes", () => {
    const root = testNode("root", { parentId: null });
    applyChangeSet(db, upsertNodes(root));
    const [loaded] = loadOutline(db).nodes;
    expect(loaded).toEqual(root);
    expect(loaded.completedAt).toBeNull();
    expect(loaded.attachmentId).toBeNull();
    expect("attributes" in loaded).toBe(false);
  });

  it("stores no attributes as SQL NULL", () => {
    applyChangeSet(db, upsertNodes(testNode("n1")));
    const raw = db.$client
      .prepare("SELECT attributes FROM nodes WHERE id = 'n1'")
      .pluck()
      .get();
    expect(raw).toBeNull();
  });
});

describe("applyChangeSet", () => {
  it("inserts and then updates a node", () => {
    applyChangeSet(db, upsertNodes(testNode("n1", { text: "old" })));
    const updated = testNode("n1", {
      text: "new",
      completedAt: 5,
      attributes: { a: 1 },
    });
    applyChangeSet(db, upsertNodes(updated));
    expect(loadOutline(db).nodes).toEqual([updated]);
  });

  it("clears attributes and completedAt on update", () => {
    applyChangeSet(
      db,
      upsertNodes(testNode("n1", { completedAt: 5, attributes: { a: 1 } })),
    );
    applyChangeSet(db, upsertNodes(testNode("n1")));
    expect(loadOutline(db).nodes).toEqual([testNode("n1")]);
  });

  it("deletes nodes", () => {
    applyChangeSet(
      db,
      upsertNodes(testNode("n1"), testNode("n2"), testNode("n3")),
    );
    const changes = emptyChangeSet();
    changes.nodes.delete.push("n1", "n3");
    applyChangeSet(db, changes);
    expect(loadOutline(db).nodes.map((n) => n.id)).toEqual(["n2"]);
  });

  it("deletes more nodes than one statement can bind", () => {
    const many = Array.from({ length: 1200 }, (_, i) => testNode(`n${i}`));
    applyChangeSet(db, upsertNodes(...many));
    const changes = emptyChangeSet();
    changes.nodes.delete.push(...many.slice(1).map((n) => n.id));
    applyChangeSet(db, changes);
    expect(loadOutline(db).nodes.map((n) => n.id)).toEqual(["n0"]);
  });

  it("upserts and deletes ui state", () => {
    const changes = emptyChangeSet();
    changes.uiState.upsert.push(
      { nodeId: "n1", collapsed: true, scrollTop: null },
      { nodeId: "n2", collapsed: false, scrollTop: 120 },
    );
    applyChangeSet(db, changes);
    expect(loadOutline(db).uiState).toEqual(changes.uiState.upsert);

    const next = emptyChangeSet();
    next.uiState.upsert.push({ nodeId: "n2", collapsed: true, scrollTop: 0 });
    next.uiState.delete.push("n1");
    applyChangeSet(db, next);
    expect(loadOutline(db).uiState).toEqual([
      { nodeId: "n2", collapsed: true, scrollTop: 0 },
    ]);
  });

  it("ignores before", () => {
    const changes = upsertNodes(testNode("n1", { text: "new" }));
    changes.nodes.before.push(testNode("n1", { text: "old" }));
    applyChangeSet(db, changes);
    expect(loadOutline(db).nodes).toEqual([testNode("n1", { text: "new" })]);
  });

  it("writes nothing if a row fails", () => {
    const changes = upsertNodes(
      testNode("n1"),
      // Violates NOT NULL in the middle of the batch.
      { ...testNode("n2"), sortKey: null } as unknown as Node,
    );
    expect(() => applyChangeSet(db, changes)).toThrow();
    expect(loadOutline(db).nodes).toEqual([]);
  });
});
