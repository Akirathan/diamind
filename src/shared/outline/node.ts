export const NODE_TYPES = ["text", "attachment"] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const NODE_FORMATS = [
  "bullet",
  "paragraph",
  "h1",
  "h2",
  "h3",
  "divider",
] as const;
export type NodeFormat = (typeof NODE_FORMATS)[number];

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type NodeAttributes = { [key: string]: JsonValue };

/** A row of the `nodes` table. Rows are immutable; a change creates a new object. */
export interface Node {
  readonly id: string;
  /** `null` only for the global root. */
  readonly parentId: string | null;
  readonly sortKey: string;
  readonly type: NodeType;
  readonly format: NodeFormat;
  readonly text: string;
  readonly note: string;
  /** Epoch milliseconds, `null` if not completed. */
  readonly completedAt: number | null;
  readonly attachmentId: string | null;
  /** `undefined` if the node has no attributes. */
  readonly attributes?: Readonly<NodeAttributes>;
  readonly createdAt: number;
  readonly modifiedAt: number;
}

/** A row of the `node_ui_state` table. */
export interface NodeUiState {
  readonly nodeId: string;
  readonly collapsed: boolean;
  readonly scrollTop: number | null;
}
