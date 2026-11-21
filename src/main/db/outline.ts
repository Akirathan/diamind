import { inArray } from "drizzle-orm";
import type { OutlineJson } from "../../shared/api";
import type { ChangeSet } from "../../shared/outline/change-set";
import type { Db } from "./database";
import { nodeToRow, uiStateToRow } from "./mapping";
import { nodes, nodeUiState } from "./schema";

// SQLite limits the number of bound parameters per statement.
const DELETE_CHUNK = 500;

const NODE_CHUNK_ROWS = 100_000;

const NODE_FIELDS = `'id', id, 'parentId', parent_id, 'sortKey', sort_key,
  'type', type, 'format', format, 'text', text, 'note', note,
  'completedAt', completed_at, 'attachmentId', attachment_id,
  'createdAt', created_at, 'modifiedAt', modified_at`;

// SQLite builds the JSON of each row; that is faster than drizzle's row
// mapping plus JSON.stringify. `attributes` is left out when NULL.
const SELECT_NODES_JSON = `SELECT CASE
    WHEN attributes IS NULL THEN json_object(${NODE_FIELDS})
    ELSE json_object(${NODE_FIELDS}, 'attributes', json(attributes))
  END FROM nodes`;

const SELECT_UI_STATE_JSON = `SELECT json_group_array(json_object(
    'nodeId', node_id,
    'collapsed', json(CASE WHEN collapsed THEN 'true' ELSE 'false' END),
    'scrollTop', scroll_top
  )) FROM node_ui_state`;

/** Reads all rows of `nodes` and `node_ui_state` as JSON text. */
export function loadOutline(
  db: Db,
  nodeChunkRows: number = NODE_CHUNK_ROWS,
): OutlineJson {
  const rows = db.$client.prepare(SELECT_NODES_JSON).pluck().all() as string[];
  const nodeChunks: string[] = [];
  for (let i = 0; i < rows.length; i += nodeChunkRows) {
    nodeChunks.push(`[${rows.slice(i, i + nodeChunkRows).join(",")}]`);
  }
  const uiState = db.$client.prepare(SELECT_UI_STATE_JSON).pluck().get();
  return { nodeChunks, uiState: uiState as string };
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
