import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import * as Y from "yjs";
import type { LoadResult } from "./load.ts";
import { createRandom, generateEdits, generateOutline } from "./outline.ts";
import { VARIANTS } from "./variants.ts";

const { values } = parseArgs({
  options: {
    sizes: { type: "string", default: "100000,200000,365000,500000" },
    "edits-per-node": { type: "string", default: "2" },
    sessions: { type: "string", default: "1000" },
    seed: { type: "string", default: "42" },
  },
});

const sizes = values.sizes.split(",").map(Number);
const editsPerNode = Number(values["edits-per-node"]);
const sessions = Number(values.sessions);
const seed = Number(values.seed);
const loadScript = new URL("./load.ts", import.meta.url).pathname;
const workDir = mkdtempSync(join(tmpdir(), "diamind-bench-"));

const MB = 1024 * 1024;
const header = [
  "nodes",
  "variant",
  "file MB",
  "file v2 MB",
  "load ms",
  "index ms",
  "search ms",
  "heap MB",
  "heap B/node",
  "rss MB",
];
const rows: string[][] = [];

function measureLoad(variant: string, file: string): LoadResult {
  const child = spawnSync(
    process.execPath,
    ["--expose-gc", "--max-old-space-size=8192", loadScript, variant, file],
    { encoding: "utf8" },
  );
  if (child.status !== 0) {
    throw new Error(`Load of ${variant} failed:\n${child.stderr}`);
  }
  return JSON.parse(child.stdout);
}

function format(value: number, digits = 0): string {
  return value.toFixed(digits);
}

console.log(
  `edits per node: ${editsPerNode}, sessions: ${sessions}, seed: ${seed}\n`,
);

try {
  for (const size of sizes) {
    const nodes = generateOutline(size, createRandom(seed));
    const edits = generateEdits(
      nodes,
      Math.round(size * editsPerNode),
      createRandom(seed + 1),
    );

    for (const variant of VARIANTS) {
      const history = { edits, sessions, random: createRandom(seed + 2) };
      const bytes = variant.save(nodes, history);
      const file = join(workDir, `${variant.name}-${size}.bin`);
      writeFileSync(file, bytes);

      const v2Size =
        variant.name === "plain"
          ? "-"
          : format(Y.convertUpdateFormatV1ToV2(bytes).length / MB, 1);
      const result = measureLoad(variant.name, file);
      rows.push([
        String(size),
        variant.name,
        format(bytes.length / MB, 1),
        v2Size,
        format(result.loadMs),
        format(result.indexMs),
        format(result.searchMs),
        format(result.heapAfterIndexBytes / MB),
        format(result.heapAfterIndexBytes / size),
        format(result.rssBytes / MB),
      ]);
      console.error(`done: ${size} ${variant.name}`);
    }
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

const lines = [header, header.map(() => "---"), ...rows];
console.log(lines.map((cells) => `| ${cells.join(" | ")} |`).join("\n"));
