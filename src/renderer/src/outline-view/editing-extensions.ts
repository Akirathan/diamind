import { EditorState, Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap, type ViewUpdate } from "@codemirror/view";
import type { NodeCursor } from "@/renderer/src/outline/cursor";
import { fromStore } from "@/renderer/src/outline-view/from-store";
import type { OutlineEditing } from "@/renderer/src/outline-view/outline-editing";
import {
  isOnFirstLine,
  isOnLastLine,
} from "@/renderer/src/outline-view/visual-line";

type NodeIdOf = (view: EditorView) => string | undefined;

/**
 * Keys, paste and cursor tracking of a node editor. Must follow the update
 * listener that writes to the store: the undo history needs the cursor before the edit.
 */
export function editingExtensions(
  editing: OutlineEditing,
  nodeIdOf: NodeIdOf,
): Extension {
  return [
    editingKeys(editing, nodeIdOf),
    EditorView.domEventHandlers({
      paste: (event, view) => {
        const text = event.clipboardData?.getData("text/plain") ?? "";
        const nodeId = nodeIdOf(view);
        if (nodeId === undefined || !/[\r\n]/.test(text)) {
          return false;
        }
        const { from, to } = view.state.selection.main;
        editing.paste(nodeId, from, to, text);
        return true;
      },
      // E.g. `Shift + Enter`, which no key binding handles.
      beforeinput: (event) =>
        event.inputType === "insertParagraph" ||
        event.inputType === "insertLineBreak",
    }),
    singleLine,
    EditorView.updateListener.of((update) =>
      trackCursor(update, editing, nodeIdOf),
    ),
  ];
}

function editingKeys(editing: OutlineEditing, nodeIdOf: NodeIdOf): Extension {
  /** Runs the key with the cursor, unless the editor has no node. */
  function onCursor(
    run: (cursor: NodeCursor, view: EditorView) => boolean,
  ): (view: EditorView) => boolean {
    return (view) => {
      const cursor = cursorOf(view, nodeIdOf);
      return cursor !== null && run(cursor, view);
    };
  }

  return Prec.high(
    keymap.of([
      {
        key: "Enter",
        run: onCursor(({ nodeId }, view) => {
          const { from, to } = view.state.selection.main;
          editing.enter(nodeId, from, to);
          return true;
        }),
      },
      {
        key: "Backspace",
        run: onCursor(({ nodeId, anchor, head }) => {
          if (anchor !== 0 || head !== 0) {
            return false;
          }
          editing.mergeIntoUpper(nodeId);
          return true;
        }),
      },
      {
        key: "Tab",
        run: onCursor((cursor) => {
          editing.indent(cursor);
          return true;
        }),
      },
      {
        key: "Shift-Tab",
        run: onCursor((cursor) => {
          editing.unindent(cursor);
          return true;
        }),
      },
      {
        key: "ArrowUp",
        run: onCursor(
          ({ nodeId }, view) =>
            isOnFirstLine(view, view.state.selection.main) &&
            editing.moveUp(nodeId),
        ),
      },
      {
        key: "ArrowDown",
        run: onCursor(
          ({ nodeId }, view) =>
            isOnLastLine(view, view.state.selection.main) &&
            editing.moveDown(nodeId),
        ),
      },
    ]),
  );
}

/** Replaces each inserted line break by a space, e.g. of dropped text. */
const singleLine = EditorState.transactionFilter.of((tr) => {
  if (
    !tr.docChanged ||
    tr.annotation(fromStore) === true ||
    tr.newDoc.lines === 1
  ) {
    return tr;
  }
  const changes: { from: number; to: number; insert: string }[] = [];
  tr.changes.iterChanges((from, to, _fromB, _toB, inserted) => {
    changes.push({
      from,
      to,
      insert: inserted.sliceString(0, inserted.length, " "),
    });
  });
  return {
    changes,
    selection: tr.selection,
    effects: tr.effects,
    scrollIntoView: tr.scrollIntoView,
  };
});

function trackCursor(
  update: ViewUpdate,
  editing: OutlineEditing,
  nodeIdOf: NodeIdOf,
): void {
  const { view, docChanged, selectionSet, focusChanged } = update;
  const cursor = cursorOf(view, nodeIdOf);
  if (
    cursor === null ||
    !(docChanged || selectionSet || focusChanged) ||
    !(view.hasFocus || editing.focus.cursor?.nodeId === cursor.nodeId)
  ) {
    return;
  }
  editing.focus.setCursor(cursor);
  if (!docChanged) {
    editing.history.breakMerge();
  } else if (!isFromStore(update)) {
    editing.history.setCursorAfter(cursor);
  }
}

function isFromStore(update: ViewUpdate): boolean {
  return update.transactions.some((tr) => tr.annotation(fromStore) === true);
}

function cursorOf(view: EditorView, nodeIdOf: NodeIdOf): NodeCursor | null {
  const nodeId = nodeIdOf(view);
  if (nodeId === undefined) {
    return null;
  }
  const { anchor, head } = view.state.selection.main;
  return { nodeId, anchor, head };
}
