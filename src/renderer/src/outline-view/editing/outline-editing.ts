import type { ChangeSet } from "@/shared/outline/change-set";
import type { Node } from "@/shared/outline/node";
import {
  cursorAt,
  type FieldRef,
  type NodeCursor,
  type NodeField,
} from "@/renderer/src/outline/editing/cursor";
import {
  cursorAbove,
  cursorBelow,
  cursorInOtherField,
  type CursorTarget,
} from "@/renderer/src/outline/editing/cursor-moves";
import * as operations from "@/renderer/src/outline/editing/edit-operations";
import { OutlineError } from "@/renderer/src/outline/model/errors";
import type { OutlineStore } from "@/renderer/src/outline/store/store";
import { UndoHistory } from "@/renderer/src/outline/history/undo";
import { isVisible } from "@/renderer/src/outline/editing/visible-nodes";
import { CurrentNode } from "@/renderer/src/outline-view/focus/current-node";
import { NodeFocus } from "@/renderer/src/outline-view/focus/node-focus";

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

  /** Returns false if there is no line above. */
  moveUp(from: FieldRef): boolean {
    const { store, rootId } = this.context;
    return this.moveTo(cursorAbove(store, rootId, from));
  }

  /** Returns false if there is no line below. */
  moveDown(from: FieldRef): boolean {
    const { store, rootId } = this.context;
    return this.moveTo(cursorBelow(store, rootId, from));
  }

  /** Moves between the text and the note. An empty note appears. */
  toggleNote(from: FieldRef): void {
    this.moveTo(cursorInOtherField(this.context.store, from));
  }

  /** Removes an empty note that lost the focus. */
  closeEmptyNote({ nodeId, field }: FieldRef): void {
    const node = this.context.store.getNode(nodeId);
    if (
      field === "note" &&
      node?.note === "" &&
      this.focus.isIn({ nodeId, field })
    ) {
      this.focus.setCursor(cursorAt(nodeId, node.text.length));
    }
  }

  private moveTo(target: CursorTarget | null): boolean {
    if (target === null) {
      return false;
    }
    this.history.breakMerge();
    this.focus.request(target);
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
      const field = changedField(changes, changed);
      this.focus.request(cursorAt(changed.id, changed[field].length, field));
    }
  }
}

/** `note` if the node differs in its note, which is still there, but not in its text. */
function changedField(changes: ChangeSet, node: Node): NodeField {
  const before = changes.nodes.before.find(({ id }) => id === node.id);
  return before?.text === node.text &&
    before.note !== node.note &&
    node.note !== ""
    ? "note"
    : "text";
}
