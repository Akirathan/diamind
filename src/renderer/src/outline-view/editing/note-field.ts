import { Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import {
  isAtStart,
  onCursor,
  type FieldOf,
} from "@/renderer/src/outline-view/editing/editor-cursor";
import type { OutlineEditing } from "@/renderer/src/outline-view/editing/outline-editing";

/** The keys that only work in the note of a node. */
export function noteField(
  editing: OutlineEditing,
  fieldOf: FieldOf,
): Extension {
  return [
    Prec.high(
      keymap.of([
        { key: "Enter", run: insertLineBreak },
        {
          key: "Backspace",
          run: onCursor(fieldOf, (cursor, view) => {
            if (!isAtStart(cursor)) {
              return false;
            }
            if (view.state.doc.length === 0) {
              editing.toggleNote(cursor);
            }
            return true;
          }),
        },
      ]),
    ),
    EditorView.domEventHandlers({
      // E.g. `Alt + Enter`, which no key binding handles.
      beforeinput: (event, view) =>
        (event.inputType === "insertParagraph" ||
          event.inputType === "insertLineBreak") &&
        insertLineBreak(view),
    }),
  ];
}

function insertLineBreak(view: EditorView): boolean {
  view.dispatch(view.state.replaceSelection("\n"), {
    scrollIntoView: true,
    userEvent: "input",
  });
  return true;
}
