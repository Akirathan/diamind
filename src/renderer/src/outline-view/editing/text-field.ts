import { EditorState, Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { fromStore } from "@/renderer/src/outline-view/editors/from-store";
import {
  isAtStart,
  onCursor,
  type FieldOf,
} from "@/renderer/src/outline-view/editing/editor-cursor";
import type { OutlineEditing } from "@/renderer/src/outline-view/editing/outline-editing";

/** The keys and the paste that only work in the text of a node. */
export function textField(
  editing: OutlineEditing,
  fieldOf: FieldOf,
): Extension {
  return [
    Prec.high(
      keymap.of([
        {
          key: "Enter",
          run: onCursor(fieldOf, ({ nodeId }, view) => {
            const { from, to } = view.state.selection.main;
            editing.enter(nodeId, from, to);
            return true;
          }),
        },
        {
          key: "Backspace",
          run: onCursor(fieldOf, (cursor) => {
            if (!isAtStart(cursor)) {
              return false;
            }
            editing.mergeIntoUpper(cursor.nodeId);
            return true;
          }),
        },
      ]),
    ),
    EditorView.domEventHandlers({
      paste: (event, view) => {
        const text = event.clipboardData?.getData("text/plain") ?? "";
        const ref = fieldOf(view);
        if (ref === undefined || !/[\r\n]/.test(text)) {
          return false;
        }
        const { from, to } = view.state.selection.main;
        editing.paste(ref.nodeId, from, to, text);
        return true;
      },
      beforeinput: (event) =>
        event.inputType === "insertParagraph" ||
        event.inputType === "insertLineBreak",
    }),
    singleLine,
  ];
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
