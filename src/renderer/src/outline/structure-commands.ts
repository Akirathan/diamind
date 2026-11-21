import type { ChangeSet } from "../../../shared/outline/change-set";
import type { Node, NodeFormat } from "../../../shared/outline/node";
import { checkEmptyTail, isEmptyNode } from "./empty-rule";
import { OutlineError } from "./errors";
import { checkFormat } from "./field-commands";
import type { OutlineModel } from "./model";

export interface NewNodeContent {
  text?: string;
  note?: string;
}

export interface InsertResult {
  id: string;
  changes: ChangeSet;
}

export function insertNode(
  model: OutlineModel,
  parentId: string,
  afterId: string | null,
  format: NodeFormat = "bullet",
  content: NewNodeContent = {},
): InsertResult {
  model.getNode(parentId);
  checkFormat(format);
  const siblings = model.childIds(parentId);
  checkAfter(siblings, parentId, afterId);

  const now = model.now();
  const node: Node = {
    id: model.newId(),
    parentId,
    sortKey: model.sortKeyAfter(parentId, afterId),
    type: "text",
    format,
    text: content.text ?? "",
    note: content.note ?? "",
    completedAt: null,
    attachmentId: null,
    createdAt: now,
    modifiedAt: now,
  };
  const after = withInserted(siblings, node.id, afterId);
  checkEmptyTail(siblings, after, (id) =>
    isEmptyNode(id === node.id ? node : model.getNode(id)),
  );

  const changes = model.record(() => model.putNode(node));
  return { id: node.id, changes };
}

/** Moves the node to be the next sibling of `afterId`, or the first child of `newParentId` if `null`. */
export function move(
  model: OutlineModel,
  id: string,
  newParentId: string,
  afterId: string | null,
): ChangeSet {
  const node = model.getNode(id);
  model.getNode(newParentId);
  checkNotRoot(model, id, "moved");
  if (model.isInSubtree(newParentId, id)) {
    throw new OutlineError(
      "moveIntoSelf",
      "A node cannot be moved into its own subtree",
    );
  }
  if (afterId === id) {
    throw new OutlineError(
      "afterNotChild",
      "A node cannot be moved after itself",
    );
  }
  checkAfter(model.childIds(newParentId), newParentId, afterId);
  return relocate(model, node, newParentId, afterId);
}

/** Makes the node the last child of its previous sibling. */
export function indent(model: OutlineModel, id: string): ChangeSet {
  const node = model.getNode(id);
  checkNotRoot(model, id, "indented");
  const siblings = model.childIds(node.parentId);
  const index = siblings.indexOf(id);
  if (index === 0) {
    throw new OutlineError(
      "noPreviousSibling",
      "The first child cannot be indented",
    );
  }
  const newParentId = siblings[index - 1];
  const newSiblings = model.childIds(newParentId);
  const lastId =
    newSiblings.length > 0 ? newSiblings[newSiblings.length - 1] : null;
  return relocate(model, node, newParentId, lastId);
}

/** Makes the node the next sibling of its parent. */
export function unindent(model: OutlineModel, id: string): ChangeSet {
  const node = model.getNode(id);
  checkNotRoot(model, id, "unindented");
  const parent = model.getNode(node.parentId as string);
  if (parent.parentId === null) {
    throw new OutlineError(
      "parentIsRoot",
      "A child of the global root cannot be unindented",
    );
  }
  return relocate(model, node, parent.parentId, parent.id);
}

/** Deletes the node with its whole subtree. The empty tail rule does not apply. */
export function deleteNode(model: OutlineModel, id: string): ChangeSet {
  model.getNode(id);
  checkNotRoot(model, id, "deleted");
  const ids = model.subtreeIds(id);
  return model.record(() => {
    for (let i = ids.length - 1; i >= 0; i--) {
      model.removeNode(ids[i]);
    }
  });
}

function relocate(
  model: OutlineModel,
  node: Node,
  newParentId: string,
  afterId: string | null,
): ChangeSet {
  const oldParentId = node.parentId as string;
  const isEmpty = (s: string): boolean => isEmptyNode(model.getNode(s));
  const oldSiblings = model.childIds(oldParentId);
  if (oldParentId === newParentId) {
    const reordered = withInserted(oldSiblings, node.id, afterId);
    if (reordered.every((s, i) => s === oldSiblings[i])) {
      return model.record(() => {});
    }
    checkEmptyTail(oldSiblings, reordered, isEmpty);
  } else {
    checkEmptyTail(
      oldSiblings,
      oldSiblings.filter((s) => s !== node.id),
      isEmpty,
    );
    const newSiblings = model.childIds(newParentId);
    checkEmptyTail(
      newSiblings,
      withInserted(newSiblings, node.id, afterId),
      isEmpty,
    );
  }

  const sortKey = model.sortKeyAfter(newParentId, afterId, node.id);
  return model.record(() =>
    model.putNode({
      ...node,
      parentId: newParentId,
      sortKey,
      modifiedAt: model.now(),
    }),
  );
}

function checkNotRoot(model: OutlineModel, id: string, action: string): void {
  if (model.isRoot(id)) {
    throw new OutlineError(
      "rootNotAllowed",
      `The global root cannot be ${action}`,
    );
  }
}

function checkAfter(
  siblings: readonly string[],
  parentId: string,
  afterId: string | null,
): void {
  if (afterId !== null && !siblings.includes(afterId)) {
    throw new OutlineError(
      "afterNotChild",
      `Node ${afterId} is not a child of ${parentId}`,
    );
  }
}

function withInserted(
  siblings: readonly string[],
  id: string,
  afterId: string | null,
): string[] {
  const result = siblings.filter((s) => s !== id);
  const index = afterId === null ? 0 : result.indexOf(afterId) + 1;
  result.splice(index, 0, id);
  return result;
}
