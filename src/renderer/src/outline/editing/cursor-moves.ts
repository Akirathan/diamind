import type { Node } from "@/shared/outline/node";
import {
  cursorAt,
  type FieldRef,
  type NodeCursor,
  type NodeField,
} from "@/renderer/src/outline/editing/cursor";
import type { OutlineStore } from "@/renderer/src/outline/store/store";
import {
  nextVisible,
  previousVisible,
} from "@/renderer/src/outline/editing/visible-nodes";

export interface CursorTarget extends NodeCursor {
  /** Moves the cursor to the beginning of its visual line, which only the editor knows. */
  readonly toLineStart?: boolean;
}

/** From the first line of a field to the line above. `null` if there is none. */
export function cursorAbove(
  store: OutlineStore,
  rootId: string,
  { nodeId, field }: FieldRef,
): CursorTarget | null {
  if (field === "note") {
    return lastLine(store.getNode(nodeId), "text");
  }
  const upperId = previousVisible(store, rootId, nodeId);
  if (upperId === null) {
    return null;
  }
  const upper = store.getNode(upperId);
  return hasNote(upper) ? lastLine(upper, "note") : cursorAt(upperId, 0);
}

/** From the last line of a field to the line below. `null` if there is none. */
export function cursorBelow(
  store: OutlineStore,
  rootId: string,
  { nodeId, field }: FieldRef,
): CursorTarget | null {
  if (field === "text" && hasNote(store.getNode(nodeId))) {
    return cursorAt(nodeId, 0, "note");
  }
  const lowerId = nextVisible(store, rootId, nodeId);
  return lowerId === null ? null : cursorAt(lowerId, 0);
}

/** To the end of the other field of the node. */
export function cursorInOtherField(
  store: OutlineStore,
  { nodeId, field }: FieldRef,
): NodeCursor | null {
  const node = store.getNode(nodeId);
  if (node === undefined) {
    return null;
  }
  return field === "text"
    ? cursorAt(nodeId, node.note.length, "note")
    : cursorAt(nodeId, node.text.length);
}

function hasNote(node: Node | undefined): boolean {
  return node !== undefined && node.note !== "";
}

function lastLine(
  node: Node | undefined,
  field: NodeField,
): CursorTarget | null {
  if (node === undefined) {
    return null;
  }
  return {
    ...cursorAt(node.id, node[field].length, field),
    toLineStart: true,
  };
}
