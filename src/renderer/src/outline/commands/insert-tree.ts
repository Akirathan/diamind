import { generateNKeysBetween } from "fractional-indexing";
import type { ChangeSet } from "@/shared/outline/change-set";
import type { Node } from "@/shared/outline/node";
import type { OutlineModel } from "@/renderer/src/outline/model/model";

export interface NewNode {
  readonly text: string;
  readonly note: string;
  readonly completed: boolean;
  readonly children: readonly NewNode[];
}

export interface InsertTreeResult {
  /** The inserted children of the parent. */
  ids: string[];
  changes: ChangeSet;
}

/**
 * Adds the nodes with their subtrees after the last child of the parent.
 * The empty tail rule does not apply.
 */
export function appendTree(
  model: OutlineModel,
  parentId: string,
  nodes: readonly NewNode[],
): InsertTreeResult {
  model.getNode(parentId);
  const now = model.now();
  const rows: Node[] = [];

  function addRows(children: readonly NewNode[], id: string): Node[] {
    const last = model.childIds(id).at(-1);
    const lastKey = last === undefined ? null : model.getNode(last).sortKey;
    const keys = generateNKeysBetween(lastKey, null, children.length);
    const added = children.map((child, i): Node => ({
      id: model.newId(),
      parentId: id,
      sortKey: keys[i],
      type: "text",
      format: "bullet",
      text: child.text,
      note: child.note,
      completedAt: child.completed ? now : null,
      attachmentId: null,
      createdAt: now,
      modifiedAt: now,
    }));
    for (const row of added) {
      rows.push(row);
    }
    return added;
  }

  const roots = addRows(nodes, parentId);
  const pending = roots.map((row, i) => ({ id: row.id, node: nodes[i] }));
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const { children } = next.node;
    addRows(children, next.id).forEach((row, i) => {
      pending.push({ id: row.id, node: children[i] });
    });
  }

  const changes = model.record(() => {
    for (const row of rows) {
      model.putNode(row);
    }
  });
  return { ids: roots.map((row) => row.id), changes };
}
