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

export function uiStateToRow(state: NodeUiState): NodeUiStateRow {
  return {
    nodeId: state.nodeId,
    collapsed: state.collapsed,
    scrollTop: state.scrollTop,
  };
}
