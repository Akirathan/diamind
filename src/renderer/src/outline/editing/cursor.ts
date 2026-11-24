/** The text selection inside a node. `head` is the moving end. */
export interface NodeCursor {
  readonly nodeId: string;
  readonly anchor: number;
  readonly head: number;
}

export function cursorAt(nodeId: string, offset: number): NodeCursor {
  return { nodeId, anchor: offset, head: offset };
}
