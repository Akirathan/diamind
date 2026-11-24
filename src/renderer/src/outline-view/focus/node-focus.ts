import type { NodeCursor } from "@/renderer/src/outline/editing/cursor";
import type { CurrentNode } from "@/renderer/src/outline-view/focus/current-node";

export interface FocusRequest extends NodeCursor {
  /** True if the cursor is not scrolled into view. */
  readonly keepScroll?: boolean;
}

/**
 * Knows the cursor in the current node, and takes requests to move it.
 * The outline view fulfills a request, because the row may have to be rendered first.
 */
export class NodeFocus {
  private lastCursor: NodeCursor | null = null;
  private lastRequest: FocusRequest | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly currentNode: CurrentNode) {}

  /** The last known cursor in the current node. It stays when the window or the editor loses the focus. */
  get cursor(): NodeCursor | null {
    const { lastCursor } = this;
    return lastCursor?.nodeId === this.currentNode.get() ? lastCursor : null;
  }

  /** Reports a cursor move that already happened in the editor of the current node. */
  setCursor(cursor: NodeCursor): void {
    this.lastCursor = cursor;
  }

  /** Focuses the node and scrolls the cursor into view. Offsets behind the text are clamped. */
  request(cursor: NodeCursor, options?: { keepScroll: boolean }): void {
    // Before the current node, so that its subscribers see the new cursor.
    this.lastCursor = cursor;
    this.currentNode.set(cursor.nodeId);
    // A copy, so that a repeated request of the same cursor is a new one.
    this.lastRequest = { ...cursor, ...options };
    for (const listener of this.listeners) {
      listener();
    }
  }

  readonly getRequest = (): FocusRequest | null => this.lastRequest;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}
