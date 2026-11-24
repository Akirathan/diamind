import { Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap, type ViewUpdate } from "@codemirror/view";
import type { NodeField } from "@/renderer/src/outline/editing/cursor";
import { fromStore } from "@/renderer/src/outline-view/editors/from-store";
import {
  cursorOf,
  onCursor,
  type FieldOf,
} from "@/renderer/src/outline-view/editing/editor-cursor";
import { noteField } from "@/renderer/src/outline-view/editing/note-field";
import type { OutlineEditing } from "@/renderer/src/outline-view/editing/outline-editing";
import { textField } from "@/renderer/src/outline-view/editing/text-field";
import {
  isOnFirstLine,
  isOnLastLine,
} from "@/renderer/src/outline-view/editing/visual-line";

/**
 * Keys, paste and cursor tracking of a node editor. Must follow the update
 * listener that writes to the store: the undo history needs the cursor before the edit.
 */
export function editingExtensions(
  editing: OutlineEditing,
  field: NodeField,
  fieldOf: FieldOf,
): Extension {
  return [
    sharedKeys(editing, fieldOf),
    field === "text"
      ? textField(editing, fieldOf)
      : noteField(editing, fieldOf),
    EditorView.updateListener.of((update) =>
      trackCursor(update, editing, fieldOf),
    ),
  ];
}

/** The keys that work in the text and in the note. */
function sharedKeys(editing: OutlineEditing, fieldOf: FieldOf): Extension {
  return Prec.high(
    keymap.of([
      {
        key: "Shift-Enter",
        run: onCursor(fieldOf, (cursor) => {
          editing.toggleNote(cursor);
          return true;
        }),
      },
      {
        key: "Tab",
        run: onCursor(fieldOf, (cursor) => {
          editing.indent(cursor);
          return true;
        }),
      },
      {
        key: "Shift-Tab",
        run: onCursor(fieldOf, (cursor) => {
          editing.unindent(cursor);
          return true;
        }),
      },
      {
        key: "ArrowUp",
        run: onCursor(
          fieldOf,
          (cursor, view) =>
            isOnFirstLine(view, view.state.selection.main) &&
            editing.moveUp(cursor),
        ),
      },
      {
        key: "ArrowDown",
        run: onCursor(
          fieldOf,
          (cursor, view) =>
            isOnLastLine(view, view.state.selection.main) &&
            editing.moveDown(cursor),
        ),
      },
    ]),
  );
}

function trackCursor(
  update: ViewUpdate,
  editing: OutlineEditing,
  fieldOf: FieldOf,
): void {
  const { view, docChanged, selectionSet, focusChanged } = update;
  const cursor = cursorOf(view, fieldOf);
  if (
    cursor === null ||
    !(docChanged || selectionSet || focusChanged) ||
    !editing.focus.isIn(cursor)
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
