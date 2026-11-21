import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Db } from "./database";
import { MIGRATIONS_FOLDER } from "./test-db";

describe("openDatabase", () => {
  let dir: string;
  let db: Db | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "diamind-db-"));
  });

  afterEach(() => {
    db?.$client.close();
    db = undefined;
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates all tables in an empty database", () => {
    db = openDatabase(join(dir, "diamind.db"), MIGRATIONS_FOLDER);
    const tables = db.$client
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_\\_%' ESCAPE '\\' AND name NOT LIKE 'sqlite%' ORDER BY name",
      )
      .pluck()
      .all();
    expect(tables).toEqual([
      "app_state",
      "attachments",
      "node_ui_state",
      "nodes",
    ]);
  });

  it("sets the pragmas", () => {
    db = openDatabase(join(dir, "diamind.db"), MIGRATIONS_FOLDER);
    expect(db.$client.pragma("journal_mode", { simple: true })).toBe("wal");
    expect(db.$client.pragma("synchronous", { simple: true })).toBe(1);
    expect(db.$client.pragma("foreign_keys", { simple: true })).toBe(1);
  });

  it("applies the migrations only once", () => {
    const file = join(dir, "diamind.db");
    openDatabase(file, MIGRATIONS_FOLDER).$client.close();
    db = openDatabase(file, MIGRATIONS_FOLDER);
    const applied = db.$client
      .prepare("SELECT count(*) FROM __drizzle_migrations")
      .pluck()
      .get();
    expect(applied).toBe(1);
  });
});
