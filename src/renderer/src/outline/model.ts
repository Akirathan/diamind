import { generateKeyBetween } from "fractional-indexing";
import {
  emptyChangeSet,
  type ChangeSet,
} from "../../../shared/outline/change-set";
import type { Node, NodeUiState } from "../../../shared/outline/node";
import { OutlineError } from "./errors";
import { compareSortKeys } from "./sort-keys";

export interface OutlineOptions {
  /** Epoch milliseconds. */
  now?: () => number;
  newId?: () => string;
}

const NO_CHILDREN: readonly string[] = Object.freeze([]);

/**
 * The mutable state behind `OutlineStore`, with primitive mutations that
 * keep the `children` index in sync and record the changed rows.
 * Commands validate everything before they call a primitive.
 */
export class OutlineModel {
  readonly nodes = new Map<string, Node>();
  /** Only parents with at least one child have an entry. */
  readonly children = new Map<string | null, string[]>();
  readonly uiState = new Map<string, NodeUiState>();
  readonly now: () => number;
  readonly newId: () => string;
  rootId = "";

  private nodesBefore = new Map<string, Node | undefined>();
  private uiStateBefore = new Map<string, NodeUiState | undefined>();

  constructor(options: OutlineOptions = {}) {
    this.now = options.now ?? Date.now;
    this.newId = options.newId ?? (() => crypto.randomUUID());
  }

  getNode(id: string): Node {
    const node = this.nodes.get(id);
    if (node === undefined) {
      throw new OutlineError("nodeNotFound", `Node ${id} does not exist`);
    }
    return node;
  }

  childIds(parentId: string | null): readonly string[] {
    return this.children.get(parentId) ?? NO_CHILDREN;
  }

  isRoot(id: string): boolean {
    return id === this.rootId;
  }

  checkNotRoot(id: string, action: string): void {
    if (this.isRoot(id)) {
      throw new OutlineError(
        "rootNotAllowed",
        `The global root cannot be ${action}`,
      );
    }
  }

  /** True if `id` is `ancestorId` or lies in its subtree. */
  isInSubtree(id: string, ancestorId: string): boolean {
    let current: string | null = id;
    while (current !== null) {
      if (current === ancestorId) {
        return true;
      }
      current = this.getNode(current).parentId;
    }
    return false;
  }

  /** Ids of the subtree of `id`, `id` first. */
  subtreeIds(id: string): string[] {
    const result = [id];
    for (let i = 0; i < result.length; i++) {
      result.push(...this.childIds(result[i]));
    }
    return result;
  }

  /**
   * A sort key for a new position right after `afterId` (or first if `null`)
   * among the children of `parentId`, ignoring `movingId`.
   */
  sortKeyAfter(
    parentId: string,
    afterId: string | null,
    movingId?: string,
  ): string {
    const siblings = this.childIds(parentId).filter((id) => id !== movingId);
    const index = afterId === null ? -1 : siblings.indexOf(afterId);
    const prev = index >= 0 ? this.getNode(siblings[index]).sortKey : null;
    const nextId = siblings[index + 1];
    const next = nextId === undefined ? null : this.getNode(nextId).sortKey;
    return generateKeyBetween(prev, next);
  }

  /** Runs primitives and returns the rows they changed. */
  record(mutate: () => void): ChangeSet {
    this.nodesBefore = new Map();
    this.uiStateBefore = new Map();
    mutate();
    const changes = emptyChangeSet();
    collect(this.nodesBefore, this.nodes, changes.nodes);
    collect(this.uiStateBefore, this.uiState, changes.uiState);
    this.nodesBefore = new Map();
    this.uiStateBefore = new Map();
    return changes;
  }

  putNode(next: Node): void {
    const prev = this.nodes.get(next.id);
    if (!this.nodesBefore.has(next.id)) {
      this.nodesBefore.set(next.id, prev);
    }
    const positionChanged =
      prev === undefined ||
      prev.parentId !== next.parentId ||
      prev.sortKey !== next.sortKey;
    if (prev !== undefined && positionChanged) {
      this.unlinkChild(prev.parentId, prev.id);
    }
    this.nodes.set(next.id, next);
    if (positionChanged) {
      this.linkChild(next);
    }
  }

  /** Removes one node. Its children must be removed before. */
  removeNode(id: string): void {
    const prev = this.getNode(id);
    if (!this.nodesBefore.has(id)) {
      this.nodesBefore.set(id, prev);
    }
    this.unlinkChild(prev.parentId, id);
    this.nodes.delete(id);
    this.removeUiState(id);
  }

  putUiState(next: NodeUiState): void {
    if (!this.uiStateBefore.has(next.nodeId)) {
      this.uiStateBefore.set(next.nodeId, this.uiState.get(next.nodeId));
    }
    this.uiState.set(next.nodeId, next);
  }

  removeUiState(nodeId: string): void {
    const prev = this.uiState.get(nodeId);
    if (prev === undefined) {
      return;
    }
    if (!this.uiStateBefore.has(nodeId)) {
      this.uiStateBefore.set(nodeId, prev);
    }
    this.uiState.delete(nodeId);
  }

  /** Inserts into the sorted children of the node's parent. */
  private linkChild(node: Node): void {
    let siblings = this.children.get(node.parentId);
    if (siblings === undefined) {
      siblings = [];
      this.children.set(node.parentId, siblings);
    }
    let low = 0;
    let high = siblings.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (compareSortKeys(this.getNode(siblings[mid]), node) < 0) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    siblings.splice(low, 0, node.id);
  }

  private unlinkChild(parentId: string | null, id: string): void {
    const siblings = this.children.get(parentId);
    if (siblings === undefined) {
      return;
    }
    const index = siblings.indexOf(id);
    if (index >= 0) {
      siblings.splice(index, 1);
    }
    if (siblings.length === 0) {
      this.children.delete(parentId);
    }
  }
}

function collect<Row>(
  before: Map<string, Row | undefined>,
  current: Map<string, Row>,
  out: { upsert: Row[]; delete: string[]; before: Row[] },
): void {
  for (const [id, prev] of before) {
    const next = current.get(id);
    if (next === prev) {
      continue;
    }
    if (next === undefined) {
      out.delete.push(id);
    } else {
      out.upsert.push(next);
    }
    if (prev !== undefined) {
      out.before.push(prev);
    }
  }
}
