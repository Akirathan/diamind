import type { ChangeSet } from "@/shared/outline/change-set";
import { cursorAt, type NodeCursor } from "@/renderer/src/outline/cursor";
import * as operations from "@/renderer/src/outline/edit-operations";
import { OutlineError } from "@/renderer/src/outline/errors";
import type { OutlineStore } from "@/renderer/src/outline/store";
import { UndoHistory } from "@/renderer/src/outline/undo";
import {
  isVisible,
  nextVisible,
  previousVisible,
} from "@/renderer/src/outline/visible-nodes";
import { CurrentNode } from "@/renderer/src/outline-view/current-node";
import { NodeFocus } from "@/renderer/src/outline-view/node-focus";

/** The editing keys. Each edit is one undo step and moves the cursor. */
export class OutlineEditing {
  readonly history: UndoHistory;
  readonly currentNode: CurrentNode;
  readonly focus: NodeFocus;
  private readonly context: operations.EditContext;

  constructor(store: OutlineStore, rootId: string) {
    this.context = { store, rootId };
    this.history = new UndoHistory(store, {
      cursor: {
        get: () => this.focus.cursor,
        restore: (cursor, changes) => this.restoreCursor(cursor, changes),
      },
    });
    // Follows the store after the history, which needs the cursor before the change.
    this.currentNode = new CurrentNode(store);
    this.focus = new NodeFocus(this.currentNode);
  }

  enter(nodeId: string, from: number, to: number): void {
    this.run(() => operations.enter(this.context, nodeId, from, to));
  }

  mergeIntoUpper(nodeId: string): void {
    this.run(() => operations.mergeIntoUpper(this.context, nodeId));
  }

  indent(cursor: NodeCursor): void {
    this.run(() => operations.indentNode(this.context, cursor));
  }

  unindent(cursor: NodeCursor): void {
    this.run(() => operations.unindentNode(this.context, cursor));
  }

  paste(nodeId: string, from: number, to: number, text: string): void {
    const lines = operations.splitLines(text);
    this.run(() =>
      operations.pasteLines(this.context, nodeId, from, to, lines),
    );
  }

  /** Returns false if there is no node above. */
  moveUp(nodeId: string): boolean {
    const { store, rootId } = this.context;
    return this.moveTo(previousVisible(store, rootId, nodeId));
  }

  /** Returns false if there is no node below. */
  moveDown(nodeId: string): boolean {
    const { store, rootId } = this.context;
    return this.moveTo(nextVisible(store, rootId, nodeId));
  }

  private moveTo(nodeId: string | null): boolean {
    if (nodeId === null) {
      return false;
    }
    this.history.breakMerge();
    this.focus.request(cursorAt(nodeId, 0));
    return true;
  }

  private run(edit: () => NodeCursor | null): void {
    const before = this.focus.cursor;
    let after: NodeCursor | null;
    try {
      after = this.history.transaction(() => {
        const cursor = edit();
        if (cursor !== null) {
          this.history.setCursorAfter(cursor);
        }
        return cursor;
      });
    } catch (error) {
      if (!(error instanceof OutlineError)) {
        throw error;
      }
      // The undone commands can move the cursor of the focused editor.
      after = before;
    }
    if (after !== null) {
      this.focus.request(after);
    }
  }

  private restoreCursor(cursor: NodeCursor | null, changes: ChangeSet): void {
    if (cursor === null) {
      return;
    }
    const { store, rootId } = this.context;
    if (isVisible(store, rootId, cursor.nodeId)) {
      this.focus.request(cursor);
      return;
    }
    const changed = changes.nodes.upsert.find((node) =>
      isVisible(store, rootId, node.id),
    );
    if (changed !== undefined) {
      this.focus.request(cursorAt(changed.id, changed.text.length));
    }
  }
}
