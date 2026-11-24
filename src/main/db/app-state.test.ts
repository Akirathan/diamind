import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStateValues } from "@/shared/app-state";
import { emptyChangeSet } from "@/shared/outline/change-set";
import { loadAppState } from "@/main/db/app-state";
import type { Db } from "@/main/db/database";
import { applyChangeSet, loadOutline } from "@/main/db/outline";
import { appState } from "@/main/db/schema";
import { openTestDatabase, testNode } from "@/main/db/test-db";

let db: Db;

beforeEach(() => {
  db = openTestDatabase();
});

afterEach(() => {
  db.$client.close();
  vi.restoreAllMocks();
});

function save(values: AppStateValues): void {
  applyChangeSet(db, { ...emptyChangeSet(), appState: values });
}

describe("app state", () => {
  it("is empty in a new database", () => {
    expect(loadAppState(db)).toEqual({});
  });

  it("round-trips the values", () => {
    const values: AppStateValues = {
      zoomedNodeId: "it's",
      navigationHistory: { entries: ["a", "ü"], index: 1 },
    };
    save(values);
    expect(loadAppState(db)).toEqual(values);
  });

  it("changes only the given keys", () => {
    save({
      zoomedNodeId: "a",
      navigationHistory: { entries: ["a"], index: 0 },
    });
    save({ zoomedNodeId: "b" });
    save({});
    expect(loadAppState(db)).toEqual({
      zoomedNodeId: "b",
      navigationHistory: { entries: ["a"], index: 0 },
    });
  });

  it("is written in the transaction of the outline", () => {
    const changes = emptyChangeSet();
    changes.nodes.upsert.push(testNode("a", { text: null as never }));
    expect(() =>
      applyChangeSet(db, { ...changes, appState: { zoomedNodeId: "a" } }),
    ).toThrow();
    expect(loadAppState(db)).toEqual({});
    expect(loadOutline(db).nodeChunks).toEqual([]);
  });

  it("skips a value that is not valid JSON", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    save({ zoomedNodeId: "a" });
    db.insert(appState).values({ key: "broken", value: "{" }).run();
    expect(loadAppState(db)).toEqual({ zoomedNodeId: "a" });
  });
});
