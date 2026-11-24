import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";
import type { Node } from "@/shared/outline/node";

const DEPTH_PATTERN = [0, 1, 2, 2, 1];
const LONG_TEXT_EVERY = 13;
const SEED_TIME = 0;

/**
 * Rows of a generated outline for development and e2e tests: the global root
 * and `count` nodes named `Node 1` .. `Node <count>` in document order.
 */
export function seedRows(count: number): Node[] {
  const root = seedNode("root", null, generateKeyBetween(null, null), "");
  const nodes: Node[] = [root];
  const childIds = new Map<string, string[]>();
  const parents = [root.id];
  for (let i = 1; i <= count; i++) {
    const depth = DEPTH_PATTERN[(i - 1) % DEPTH_PATTERN.length];
    const parentId = parents[depth];
    const id = `seed-${i}`;
    parents[depth + 1] = id;
    let siblings = childIds.get(parentId);
    if (siblings === undefined) {
      siblings = [];
      childIds.set(parentId, siblings);
    }
    siblings.push(id);
    nodes.push(seedNode(id, parentId, "", seedText(i)));
  }

  const sortKeys = new Map<string, string>();
  for (const siblings of childIds.values()) {
    const keys = generateNKeysBetween(null, null, siblings.length);
    for (let i = 0; i < siblings.length; i++) {
      sortKeys.set(siblings[i], keys[i]);
    }
  }
  return nodes.map((node) => {
    const sortKey = sortKeys.get(node.id);
    return sortKey === undefined ? node : { ...node, sortKey };
  });
}

function seedText(i: number): string {
  if (i % LONG_TEXT_EVERY === 0) {
    return `Node ${i} ${"with a long text that wraps to more lines ".repeat(8)}`;
  }
  return `Node ${i}`;
}

function seedNode(
  id: string,
  parentId: string | null,
  sortKey: string,
  text: string,
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
    createdAt: SEED_TIME,
    modifiedAt: SEED_TIME,
  };
}
