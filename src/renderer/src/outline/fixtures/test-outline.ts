import { generateNKeysBetween } from "fractional-indexing";
import type { Node } from "@/shared/outline/node";
import { expect } from "vitest";
import {
  OutlineError,
  type OutlineErrorCode,
} from "@/renderer/src/outline/model/errors";
import { OutlineStore } from "@/renderer/src/outline/store/store";

export const ROOT = "root";
export const CREATED_AT = 1000;

export interface TestOutline {
  store: OutlineStore;
  /** The clock of the store; set it to control `modifiedAt`. */
  clock: { now: number };
}

/**
 * Builds a store from an indented outline, two spaces per level.
 * Each line is a node id, which is also its text. `~id` is an empty node.
 */
export function createOutline(source: string): TestOutline {
  const root = testNode(ROOT, null, "a0");
  const nodes: Node[] = [root];
  const lines = dedent(source);
  const parents: string[] = [ROOT];
  const childrenByParent = new Map<string, string[]>();
  for (const line of lines) {
    const depth = (line.length - line.trimStart().length) / 2;
    const name = line.trim();
    const id = name.replace(/^~/, "");
    const parentId = parents[depth];
    parents[depth + 1] = id;
    parents.length = depth + 2;
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(id);
    childrenByParent.set(parentId, siblings);
    nodes.push(testNode(id, parentId, "", name.startsWith("~") ? "" : id));
  }
  const keyed = nodes.map((node) => {
    if (node.parentId === null) {
      return node;
    }
    const siblings = childrenByParent.get(node.parentId) as string[];
    const keys = generateNKeysBetween(null, null, siblings.length);
    return { ...node, sortKey: keys[siblings.indexOf(node.id)] };
  });
  // Shuffle to check that the load does not depend on the row order.
  keyed.reverse();

  const clock = { now: 2000 };
  let nextId = 1;
  const { store } = OutlineStore.load(
    { nodes: keyed },
    { now: () => clock.now, newId: () => `n${nextId++}` },
  );
  return { store, clock };
}

export function testNode(
  id: string,
  parentId: string | null,
  sortKey: string,
  text = id,
): Node {
  return {
    id,
    parentId,
    sortKey,
    type: "text",
    format: "bullet",
    text,
    note: "",
    completedAt: null,
    attachmentId: null,
    createdAt: CREATED_AT,
    modifiedAt: CREATED_AT,
  };
}

/** The outline in the format of `createOutline`, without the root. */
export function dump(store: OutlineStore): string {
  const lines: string[] = [];
  const visit = (id: string, depth: number): void => {
    const node = store.getNode(id) as Node;
    const empty = node.text === "" && node.note === "";
    const name = empty ? `~${id}` : id;
    lines.push(`${"  ".repeat(depth)}${name}`);
    for (const child of store.getChildren(id)) {
      visit(child, depth + 1);
    }
  };
  for (const child of store.getChildren(store.rootId)) {
    visit(child, 0);
  }
  return lines.join("\n");
}

/** Lines of a template literal without the common indentation. */
export function outline(source: string): string {
  return dedent(source).join("\n");
}

function dedent(source: string): string[] {
  const lines = source.split("\n").filter((line) => line.trim() !== "");
  const indent = Math.min(
    ...lines.map((line) => line.length - line.trimStart().length),
  );
  return lines.map((line) => line.slice(indent));
}

export function expectOutlineError(
  run: () => unknown,
  code: OutlineErrorCode,
): void {
  let thrown: unknown;
  try {
    run();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(OutlineError);
  expect((thrown as OutlineError).code).toBe(code);
}

/** All rows reachable from the root, to check that nothing changed. */
export function snapshot(store: OutlineStore): unknown[] {
  const rows: unknown[] = [];
  const visit = (id: string): void => {
    rows.push(store.getNode(id), store.getUiState(id));
    for (const child of store.getChildren(id)) {
      visit(child);
    }
  };
  visit(store.rootId);
  return structuredClone(rows);
}

/** Expects the command to throw `code` and to leave the store unchanged. */
export function expectRejected(
  store: OutlineStore,
  run: () => unknown,
  code: OutlineErrorCode,
): void {
  const before = snapshot(store);
  expectOutlineError(run, code);
  expect(snapshot(store)).toEqual(before);
}
