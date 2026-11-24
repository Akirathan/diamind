/** The editable texts of a node. Each one has its own editor. */
export type NodeField = "text" | "note";

export interface FieldRef {
  readonly nodeId: string;
  readonly field: NodeField;
}

/** The text selection inside a field of a node. `head` is the moving end. */
export interface NodeCursor extends FieldRef {
  readonly anchor: number;
  readonly head: number;
}

export function cursorAt(
  nodeId: string,
  offset: number,
  field: NodeField = "text",
): NodeCursor {
  return { nodeId, field, anchor: offset, head: offset };
}

export function isSameField(a: FieldRef, b: FieldRef): boolean {
  return a.nodeId === b.nodeId && a.field === b.field;
}
