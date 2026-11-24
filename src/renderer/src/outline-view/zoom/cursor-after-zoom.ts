import { isEmptyNode } from "@/renderer/src/outline/commands/empty-rule";
import {
  cursorAt,
  type NodeCursor,
} from "@/renderer/src/outline/editing/cursor";
import {
  hasTitle,
  isVisible,
} from "@/renderer/src/outline/editing/visible-nodes";
import type { OutlineStore } from "@/renderer/src/outline/store/store";

/** `cursor` is the one before the zoom. */
export function cursorAfterZoom(
  store: OutlineStore,
  rootId: string,
  previousRootId: string,
  cursor: NodeCursor | null,
): NodeCursor | null {
  const children = store.getChildren(rootId);
  const first = store.getNode(children[0]);
  if (first !== undefined && children.length === 1 && isEmptyNode(first)) {
    return cursorAt(first.id, 0);
  }
  if (cursor !== null && isVisible(store, rootId, cursor.nodeId)) {
    return cursor;
  }
  if (isVisible(store, rootId, previousRootId)) {
    return endOf(store, previousRootId);
  }
  if (hasTitle(store, rootId)) {
    return endOf(store, rootId);
  }
  return first === undefined ? null : cursorAt(first.id, 0);
}

function endOf(store: OutlineStore, id: string): NodeCursor {
  return cursorAt(id, store.getNode(id)?.text.length ?? 0);
}
