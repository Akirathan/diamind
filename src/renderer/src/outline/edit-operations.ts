import type { Node } from "@/shared/outline/node";
import { cursorAt, type NodeCursor } from "@/renderer/src/outline/cursor";
import { isEmptyNode } from "@/renderer/src/outline/empty-rule";
import { OutlineError } from "@/renderer/src/outline/errors";
import type { OutlineStore } from "@/renderer/src/outline/store";
import {
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
  if (after === "") {
    const { id: newId } = isExpanded(store, id)
      ? store.insertNode(id, null)
      : store.insertNode(parentId, id);
    return cursorAt(newId, 0);
  }
  if (before === "") {
    const siblings = store.getChildren(parentId);
    const index = siblings.indexOf(id);
    store.insertNode(parentId, index === 0 ? null : siblings[index - 1]);
    return cursorAt(id, 0);
  }
  store.setText(id, before);
  const { id: newId } = store.insertNode(parentId, id, "bullet", {
    text: after,
  });
  return cursorAt(newId, 0);
}

function enterInEmptyNode(
  store: OutlineStore,
  rootId: string,
  node: Node,
): NodeCursor | null {
  const parentId = node.parentId as string;
  if (store.getChildren(parentId).at(-1) !== node.id) {
    return cursorAt(store.insertNode(parentId, node.id).id, 0);
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
  let previousId = id;
  for (const line of rest) {
    previousId = insertBelow(store, parentId, previousId, line);
  }
  const lastId = insertBelow(store, parentId, previousId, lastLine + after);
  return cursorAt(lastId, lastLine.length);
}

function insertBelow(
  store: OutlineStore,
  parentId: string,
  afterId: string,
  text: string,
): string {
  return store.insertNode(parentId, afterId, "bullet", { text }).id;
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
