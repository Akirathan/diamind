// Runs in a fresh process per measurement, so heap numbers are not mixed between variants.
import { readFileSync } from "node:fs";
import { findVariant } from "./variants.ts";

export interface LoadResult {
  loadMs: number;
  indexMs: number;
  searchMs: number;
  heapAfterLoadBytes: number;
  heapAfterIndexBytes: number;
  rssBytes: number;
}

const gc = globalThis.gc;
if (gc === undefined) {
  throw new Error("Run with --expose-gc");
}

function heapUsed(): number {
  gc!();
  gc!();
  return process.memoryUsage().heapUsed;
}

const [variantName, file] = process.argv.slice(2);
const variant = findVariant(variantName);
const baseline = heapUsed();

let bytes: Uint8Array | null = readFileSync(file);
let start = performance.now();
const outline = variant.load(bytes);
const loadMs = performance.now() - start;
bytes = null;
const heapAfterLoadBytes = heapUsed() - baseline;

start = performance.now();
const index = outline.buildChildIndex();
const indexMs = performance.now() - start;
const heapAfterIndexBytes = heapUsed() - baseline;

start = performance.now();
outline.countMatches("budget review");
const searchMs = performance.now() - start;

const result: LoadResult = {
  loadMs,
  indexMs,
  searchMs,
  heapAfterLoadBytes,
  heapAfterIndexBytes,
  rssBytes: process.memoryUsage().rss,
};
process.stdout.write(JSON.stringify(result));

// Keeps the index reachable during the heap measurement.
if (index.size === 0) {
  process.exitCode = 1;
}
