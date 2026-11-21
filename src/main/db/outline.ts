import { inArray } from "drizzle-orm";
import type { LoadedOutline } from "../../shared/api";
import type { ChangeSet } from "../../shared/outline/change-set";
import type { Db } from "./database";
import { nodeToRow, rowToNode, rowToUiState, uiStateToRow } from "./mapping";
import { nodes, nodeUiState } from "./schema";

// SQLite limits the number of bound parameters per statement.
const DELETE_CHUNK = 500;

export function loadOutline(db: Db): LoadedOutline {
  return {
    nodes: db.select().from(nodes).all().map(rowToNode),
    uiState: db.select().from(nodeUiState).all().map(rowToUiState),
  };
}

/** Writes the changed rows in one transaction. `before` is ignored. */
export function applyChangeSet(db: Db, changes: ChangeSet): void {
  db.transaction((tx) => {
    for (const ids of chunks(changes.nodes.delete)) {
      tx.delete(nodes).where(inArray(nodes.id, ids)).run();
    }
    for (const ids of chunks(changes.uiState.delete)) {
      tx.delete(nodeUiState).where(inArray(nodeUiState.nodeId, ids)).run();
    }
    for (const node of changes.nodes.upsert) {
      const row = nodeToRow(node);
      tx.insert(nodes)
        .values(row)
        .onConflictDoUpdate({ target: nodes.id, set: row })
        .run();
    }
    for (const state of changes.uiState.upsert) {
      const row = uiStateToRow(state);
      tx.insert(nodeUiState)
        .values(row)
        .onConflictDoUpdate({ target: nodeUiState.nodeId, set: row })
        .run();
    }
  });
}

function* chunks(ids: readonly string[]): Generator<string[]> {
  for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
    yield ids.slice(i, i + DELETE_CHUNK);
  }
}
