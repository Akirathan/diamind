import type { EditorView } from "@codemirror/view";
import type { SelectionRange } from "@codemirror/state";

/** True if the start of the selection is on the first visual line of the wrapped text. */
export function isOnFirstLine(
  view: EditorView,
  range: SelectionRange,
): boolean {
  const cursor = cursorBox(view, range, range.from);
  const first = view.coordsAtPos(0, 1);
  return cursor === null || first === null || middle(cursor) < first.bottom;
}

/** True if the end of the selection is on the last visual line of the wrapped text. */
export function isOnLastLine(view: EditorView, range: SelectionRange): boolean {
  const cursor = cursorBox(view, range, range.to);
  const last = view.coordsAtPos(view.state.doc.length, -1);
  return cursor === null || last === null || middle(cursor) > last.top;
}

/** At a wrap, the same offset is the end of one line and the start of the next one. */
function cursorBox(view: EditorView, range: SelectionRange, offset: number) {
  const side = range.empty && range.assoc < 0 ? -1 : 1;
  return view.coordsAtPos(offset, side);
}

function middle(box: { top: number; bottom: number }): number {
  return (box.top + box.bottom) / 2;
}
