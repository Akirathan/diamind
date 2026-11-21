// Measures the startup read of generated nodes.
// Usage: npx tsx scripts/bench-startup-read.ts <count> [dataDir]
// With `dataDir`, the database is kept there, e.g. to start the app with it.
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseOutlineJson } from "../src/shared/api";
import { openDatabase } from "../src/main/db/database";
import { loadOutline } from "../src/main/db/outline";

const count = Number(process.argv[2] ?? 100_000);
const keepDir = process.argv[3];
const dir = keepDir ?? mkdtempSync(join(tmpdir(), "diamind-bench-"));
mkdirSync(dir, { recursive: true });
const db = openDatabase(
  join(dir, "diamind.db"),
  resolve("src/main/db/migrations"),
);

const insert = db.$client.prepare(
  `INSERT INTO nodes (id, parent_id, sort_key, type, format, text, note,
     completed_at, attributes, attachment_id, created_at, modified_at)
   VALUES (?, ?, ?, 'text', 'bullet', ?, ?, ?, ?, NULL, ?, ?)`,
);
db.$client.transaction(() => {
  const now = Date.now();
  insert.run("root", null, "a0", "", "", null, null, now, now);
  for (let i = 1; i < count; i++) {
    const parent = i < 100 ? "root" : `n${Math.floor(i / 10)}`;
    insert.run(
      `n${i}`,
      parent,
      `a${i}`,
      `Node number ${i} with some typical text in it`,
      i % 10 === 0 ? `A note for node ${i}` : "",
      i % 7 === 0 ? now : null,
      i % 20 === 0 ? JSON.stringify({ status: "todo", priority: i % 3 }) : null,
      now,
      now,
    );
  }
})();

for (let run = 0; run < 3; run++) {
  const start = performance.now();
  const json = loadOutline(db);
  const read = performance.now();
  const outline = parseOutlineJson(json);
  const parsed = performance.now();
  console.log(
    `${outline.nodes.length} nodes: read ${(read - start).toFixed(0)} ms,` +
      ` parse ${(parsed - read).toFixed(0)} ms`,
  );
}

db.$client.close();
if (keepDir === undefined) {
  rmSync(dir, { recursive: true, force: true });
}
