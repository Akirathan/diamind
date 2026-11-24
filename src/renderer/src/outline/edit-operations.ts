import type { Node, NodeFormat } from "@/shared/outline/node";
import { cursorAt, type NodeCursor } from "@/renderer/src/outline/cursor";
import { isEmptyNode } from "@/renderer/src/outline/empty-rule";
import { OutlineError } from "@/renderer/src/outline/errors";
import type { OutlineStore } from "@/renderer/src/outline/store";
import {
  isCollapsed,
  isExpanded,
  previousVisible,
} from "@/renderer/src/outline/visible-nodes";

/**
 * Edits across nodes, each of them made of several store commands.
 * They return the new cursor, or `null` if there is nothing to do.
 * They can throw an `OutlineError` after some commands are done, so run them
 * in `UndoHistory.transaction()`.
 */
export interface EditContext {
  store: OutlineStore;
  /** The local root. */
  rootId: string;
}

/** `from` and `to` are the selected range in the text of the node. */
export function enter(
  { store, rootId }: EditContext,
  id: string,
  from: number,
  to: number,
): NodeCursor | null {
  const node = getNode(store, id);
  const before = node.text.slice(0, from);
  const after = node.text.slice(to);
  if (from !== to) {
    store.setText(id, before + after);
    if (before + after === "") {
      return cursorAt(id, 0);
    }
  }
  if (isEmptyNode(getNode(store, id))) {
    return enterInEmptyNode(store, rootId, node);
  }
  const parentId = node.parentId as string;
  const format = continuedFormat(node);
  if (after === "") {
    return isExpanded(store, id)
      ? insertEmpty(store, id, null, format)
      : insertEmpty(store, parentId, id, format);
  }
  if (before === "") {
    const siblings = store.getChildren(parentId);
    const index = siblings.indexOf(id);
    const aboveId = index === 0 ? null : siblings[index - 1];
    store.insertNode(parentId, aboveId, format);
    return cursorAt(id, 0);
  }
  store.setText(id, before);
  const { id: newId } = store.insertNode(parentId, id, format, {
    text: after,
  });
  if (store.getChildren(id).length > 0) {
    store.moveChildren(id, newId);
    store.setCollapsed(newId, isCollapsed(store, id));
    store.setCollapsed(id, false);
  }
  return cursorAt(newId, 0);
}

/** The format of a node that is created by an edit of `node`. */
function continuedFormat(node: Node): NodeFormat {
  return node.format === "paragraph" ? "paragraph" : "bullet";
}

/**
 * Inserts an empty node, or goes to the empty last child that would follow it:
 * the last two children cannot both be empty.
 */
function insertEmpty(
  store: OutlineStore,
  parentId: string,
  afterId: string | null,
  format: NodeFormat,
): NodeCursor {
  const siblings = store.getChildren(parentId);
  const nextIndex = afterId === null ? 0 : siblings.indexOf(afterId) + 1;
  if (nextIndex === siblings.length - 1) {
    const nextId = siblings[nextIndex];
    if (isEmptyNode(getNode(store, nextId))) {
      return cursorAt(nextId, 0);
    }
  }
  return cursorAt(store.insertNode(parentId, afterId, format).id, 0);
}

function enterInEmptyNode(
  store: OutlineStore,
  rootId: string,
  node: Node,
): NodeCursor | null {
  const parentId = node.parentId as string;
  if (store.getChildren(parentId).at(-1) !== node.id) {
    const { id } = store.insertNode(parentId, node.id, continuedFormat(node));
    return cursorAt(id, 0);
  }
  if (parentId === rootId) {
    return null;
  }
  store.unindent(node.id);
  return cursorAt(node.id, 0);
}

/** Merges the node into the previous visible node. */
export function mergeIntoUpper(
  { store, rootId }: EditContext,
  id: string,
): NodeCursor | null {
  const upperId = previousVisible(store, rootId, id);
  if (upperId === null) {
    return null;
  }
  const node = getNode(store, id);
  const upper = getNode(store, upperId);
  if (!hasText(node) || !hasText(upper)) {
    return null;
  }
  store.setText(upperId, upper.text + node.text);
  store.setNote(upperId, joinNotes(upper.note, node.note));
  for (const [key, value] of Object.entries(node.attributes ?? {})) {
    if (!Object.hasOwn(upper.attributes ?? {}, key)) {
      store.setAttribute(upperId, key, value);
    }
  }
  mergeCollapsed(store, id, upperId);
  store.dissolveNode(id, upperId);
  return cursorAt(upperId, upper.text.length);
}

function joinNotes(upper: string, lower: string): string {
  return upper !== "" && lower !== "" ? `${upper}\n${lower}` : upper + lower;
}

/** Keeps the visible children of the merged node visible, and the collapsed ones collapsed. */
function mergeCollapsed(
  store: OutlineStore,
  id: string,
  upperId: string,
): void {
  if (isExpanded(store, id)) {
    store.setCollapsed(upperId, false);
  } else if (
    store.getChildren(id).length > 0 &&
    store.getChildren(upperId).length === 0
  ) {
    store.setCollapsed(upperId, true);
  }
}

export function indentNode(
  { store }: EditContext,
  cursor: NodeCursor,
): NodeCursor {
  store.indent(cursor.nodeId);
  return cursor;
}

export function unindentNode(
  { store, rootId }: EditContext,
  cursor: NodeCursor,
): NodeCursor | null {
  if (getNode(store, cursor.nodeId).parentId === rootId) {
    return null;
  }
  store.unindent(cursor.nodeId);
  return cursor;
}

/** The lines of pasted text, without the blank ones. */
export function splitLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/).filter((line) => line.trim() !== "");
}

/** Replaces the selected range. Each line after the first one becomes a new sibling below. */
export function pasteLines(
  { store }: EditContext,
  id: string,
  from: number,
  to: number,
  lines: readonly string[],
): NodeCursor | null {
  if (lines.length === 0) {
    return null;
  }
  const node = getNode(store, id);
  const before = node.text.slice(0, from);
  const after = node.text.slice(to);
  const [first, ...rest] = lines;
  const lastLine = rest.pop();
  if (lastLine === undefined) {
    store.setText(id, before + first + after);
    return cursorAt(id, from + first.length);
  }
  store.setText(id, before + first);
  const parentId = node.parentId as string;
  const format = continuedFormat(node);
  let previousId = id;
  for (const text of [...rest, lastLine + after]) {
    previousId = store.insertNode(parentId, previousId, format, { text }).id;
  }
  return cursorAt(previousId, lastLine.length);
}

function getNode(store: OutlineStore, id: string): Node {
  const node = store.getNode(id);
  if (node === undefined) {
    throw new OutlineError("nodeNotFound", `Node ${id} does not exist`);
  }
  return node;
}

function hasText(node: Node): boolean {
  return node.type === "text" && node.format !== "divider";
}
