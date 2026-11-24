import type { NodeCursor } from "@/renderer/src/outline/cursor";

/**
 * Knows the node with the cursor, and takes requests to move the cursor.
 * The outline view fulfills a request, because the row may have to be rendered first.
 */
export class NodeFocus {
  private current: NodeCursor | null = null;
  private lastRequest: NodeCursor | null = null;
  private readonly listeners = new Set<() => void>();

  /** The last known cursor. It stays when the window or the editor loses the focus. */
  get cursor(): NodeCursor | null {
    return this.current;
  }

  /** Reports a cursor move that already happened in an editor. */
  setCursor(cursor: NodeCursor): void {
    this.current = cursor;
  }

  /** Focuses the node and scrolls the cursor into view. Offsets behind the text are clamped. */
  request(cursor: NodeCursor): void {
    this.current = cursor;
    // A copy, so that a repeated request of the same cursor is a new one.
    this.lastRequest = { ...cursor };
    for (const listener of this.listeners) {
      listener();
    }
  }

  readonly getRequest = (): NodeCursor | null => this.lastRequest;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}
