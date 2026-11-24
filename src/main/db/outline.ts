import { inArray } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { OutlineJson } from "@/shared/api";
import type { ChangeBatch } from "@/shared/outline/change-set";
import { writeAppState } from "@/main/db/app-state";
import type { Db } from "@/main/db/database";
import { nodeToRow, uiStateToRow } from "@/main/db/mapping";
import { nodes, nodeUiState } from "@/main/db/schema";
import { selectRowsAsJson, upsertPlaceholders } from "@/main/db/table-sql";

// SQLite limits the number of bound parameters per statement.
const DELETE_CHUNK = 500;

const NODE_CHUNK_ROWS = 100_000;

/** Reads all rows of `nodes` and `node_ui_state` as JSON text. */
export function loadOutline(
  db: Db,
  nodeChunkRows: number = NODE_CHUNK_ROWS,
): OutlineJson {
  const rows = readRowsAsJson(db, nodes);
  const nodeChunks: string[] = [];
  for (let i = 0; i < rows.length; i += nodeChunkRows) {
    nodeChunks.push(toJsonArray(rows.slice(i, i + nodeChunkRows)));
  }
  return { nodeChunks, uiState: toJsonArray(readRowsAsJson(db, nodeUiState)) };
}

function readRowsAsJson(db: Db, table: SQLiteTable): string[] {
  return db.$client.prepare(selectRowsAsJson(table)).pluck().all() as string[];
}

function toJsonArray(rows: readonly string[]): string {
  return `[${rows.join(",")}]`;
}

/** Writes the changed rows of all tables in one transaction. */
export function applyChangeSet(db: Db, changes: ChangeBatch): void {
  db.transaction((tx) => {
    for (const ids of chunks(changes.nodes.delete)) {
      tx.delete(nodes).where(inArray(nodes.id, ids)).run();
    }
    for (const ids of chunks(changes.uiState.delete)) {
      tx.delete(nodeUiState).where(inArray(nodeUiState.nodeId, ids)).run();
    }
    const nodeSql = upsertPlaceholders(nodes);
    const upsertNode = tx
      .insert(nodes)
      .values(nodeSql.values)
      .onConflictDoUpdate({ target: nodes.id, set: nodeSql.set })
      .prepare();
    for (const node of changes.nodes.upsert) {
      upsertNode.run(nodeToRow(node));
    }
    const uiStateSql = upsertPlaceholders(nodeUiState);
    const upsertUiState = tx
      .insert(nodeUiState)
      .values(uiStateSql.values)
      .onConflictDoUpdate({ target: nodeUiState.nodeId, set: uiStateSql.set })
      .prepare();
    for (const state of changes.uiState.upsert) {
      upsertUiState.run(uiStateToRow(state));
    }
    writeAppState(tx, changes.appState ?? {});
  });
}

function* chunks(ids: readonly string[]): Generator<string[]> {
  for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
    yield ids.slice(i, i + DELETE_CHUNK);
  }
}
