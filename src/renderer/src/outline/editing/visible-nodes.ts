import type { OutlineStore } from "@/renderer/src/outline/store/store";

export function isCollapsed(store: OutlineStore, id: string): boolean {
  return store.getUiState(id)?.collapsed === true;
}

/** True if the node has children that are not collapsed. */
export function isExpanded(store: OutlineStore, id: string): boolean {
  return store.getChildren(id).length > 0 && !isCollapsed(store, id);
}

/** True if the node is below `rootId` and no node between them is collapsed. */
export function isVisible(
  store: OutlineStore,
  rootId: string,
  id: string,
): boolean {
  let parentId = store.getNode(id)?.parentId ?? null;
  while (parentId !== null) {
    if (parentId === rootId) {
      return true;
    }
    if (isCollapsed(store, parentId)) {
      return false;
    }
    parentId = store.getNode(parentId)?.parentId ?? null;
  }
  return false;
}

/** The visible node above a visible node, or `null` for the first one. */
export function previousVisible(
  store: OutlineStore,
  rootId: string,
  id: string,
): string | null {
  const parentId = store.getNode(id)?.parentId ?? null;
  if (id === rootId || parentId === null) {
    return null;
  }
  const siblings = store.getChildren(parentId);
  const index = siblings.indexOf(id);
  if (index === 0) {
    return parentId === rootId ? null : parentId;
  }
  let current = siblings[index - 1];
  while (isExpanded(store, current)) {
    const children = store.getChildren(current);
    current = children[children.length - 1];
  }
  return current;
}

/** The visible node below a visible node, or `null` for the last one. */
export function nextVisible(
  store: OutlineStore,
  rootId: string,
  id: string,
): string | null {
  if (isExpanded(store, id)) {
    return store.getChildren(id)[0];
  }
  let current = id;
  while (current !== rootId) {
    const parentId = store.getNode(current)?.parentId ?? null;
    if (parentId === null) {
      return null;
    }
    const siblings = store.getChildren(parentId);
    const index = siblings.indexOf(current);
    if (index + 1 < siblings.length) {
      return siblings[index + 1];
    }
    current = parentId;
  }
  return null;
}
