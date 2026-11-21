import type { Node, NodeUiState } from "../../shared/outline/node";
import type { NodeRow, NodeUiStateRow } from "./schema";

export function nodeToRow(node: Node): NodeRow {
  return {
    id: node.id,
    parentId: node.parentId,
    sortKey: node.sortKey,
    type: node.type,
    format: node.format,
    text: node.text,
    note: node.note,
    completedAt: node.completedAt,
    attributes: node.attributes ?? null,
    attachmentId: node.attachmentId,
    createdAt: node.createdAt,
    modifiedAt: node.modifiedAt,
  };
}

export function rowToNode(row: NodeRow): Node {
  const node: Node = {
    id: row.id,
    parentId: row.parentId,
    sortKey: row.sortKey,
    type: row.type,
    format: row.format,
    text: row.text,
    note: row.note,
    completedAt: row.completedAt,
    attachmentId: row.attachmentId,
    createdAt: row.createdAt,
    modifiedAt: row.modifiedAt,
  };
  if (row.attributes === null) {
    return node;
  }
  return { ...node, attributes: row.attributes };
}

export function uiStateToRow(state: NodeUiState): NodeUiStateRow {
  return {
    nodeId: state.nodeId,
    collapsed: state.collapsed,
    scrollTop: state.scrollTop,
  };
}

export function rowToUiState(row: NodeUiStateRow): NodeUiState {
  return {
    nodeId: row.nodeId,
    collapsed: row.collapsed,
    scrollTop: row.scrollTop,
  };
}
