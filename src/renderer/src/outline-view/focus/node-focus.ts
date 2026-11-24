import {
  isSameField,
  type FieldRef,
  type NodeCursor,
} from "@/renderer/src/outline/editing/cursor";
import type { CursorTarget } from "@/renderer/src/outline/editing/cursor-moves";
import type { CurrentNode } from "@/renderer/src/outline-view/focus/current-node";

/**
 * Knows the cursor in the current node, and takes requests to move it.
 * The outline view fulfills a request, because the row may have to be rendered first.
 */
export class NodeFocus {
  private lastCursor: NodeCursor | null = null;
  private lastRequest: CursorTarget | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly fieldListeners = new Set<() => void>();

  constructor(private readonly currentNode: CurrentNode) {}

  /** The last known cursor in the current node. It stays when the window or the editor loses the focus. */
  get cursor(): NodeCursor | null {
    const { lastCursor } = this;
    return lastCursor?.nodeId === this.currentNode.get() ? lastCursor : null;
  }

  isIn(ref: FieldRef): boolean {
    const { cursor } = this;
    return cursor !== null && isSameField(cursor, ref);
  }

  /** Reports a cursor move that already happened in the editor of the current node. */
  setCursor(cursor: NodeCursor): void {
    const last = this.lastCursor;
    this.lastCursor = cursor;
    if (last === null || !isSameField(last, cursor)) {
      notify(this.fieldListeners);
    }
  }

  /** Focuses the node and scrolls the cursor into view. Offsets behind the text are clamped. */
  request(target: CursorTarget): void {
    // Before the current node, so that its subscribers see the new cursor.
    this.setCursor(target);
    this.currentNode.set(target.nodeId);
    // A copy, so that a repeated request of the same cursor is a new one.
    this.lastRequest = { ...target };
    notify(this.listeners);
  }

  readonly getRequest = (): CursorTarget | null => this.lastRequest;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Notifies when the cursor moves to another field. */
  readonly subscribeField = (listener: () => void): (() => void) => {
    this.fieldListeners.add(listener);
    return () => {
      this.fieldListeners.delete(listener);
    };
  };
}

function notify(listeners: ReadonlySet<() => void>): void {
  for (const listener of listeners) {
    listener();
  }
}
