import type { Node, NodeUiState } from "@/shared/outline/node";

/**
 * Changed rows of one table.
 * `before` holds the previous version of every upserted row that existed
 * and of every deleted row, so an inverse change can be built for undo.
 */
export interface TableChanges<Row> {
  upsert: Row[];
  delete: string[];
  before: Row[];
}

export interface ChangeSet {
  nodes: TableChanges<Node>;
  uiState: TableChanges<NodeUiState>;
}

export function emptyChangeSet(): ChangeSet {
  return {
    nodes: { upsert: [], delete: [], before: [] },
    uiState: { upsert: [], delete: [], before: [] },
  };
}

export function isEmptyChangeSet(changes: ChangeSet): boolean {
  return (
    changes.nodes.upsert.length === 0 &&
    changes.nodes.delete.length === 0 &&
    changes.uiState.upsert.length === 0 &&
    changes.uiState.delete.length === 0
  );
}
