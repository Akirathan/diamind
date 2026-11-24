import type { EditorView } from "@codemirror/view";

const MARGIN_PX = 4;
/** Rows near the cursor are measured only after the scroll, which can move the cursor. */
const MAX_CORRECTIONS = 5;

/** Scrolls until the cursor of the editor is visible. Does nothing if it already is. */
export function revealCursor(view: EditorView, scroller: HTMLElement): void {
  let corrections = 0;

  function reveal(): void {
    if (corrections > 0 && !view.hasFocus) {
      return;
    }
    const delta = scrollDelta(view, scroller);
    if (delta !== 0) {
      scroller.scrollTop += delta;
    }
    if (corrections < MAX_CORRECTIONS && (delta !== 0 || corrections > 0)) {
      corrections++;
      requestAnimationFrame(reveal);
    }
  }

  reveal();
}

function scrollDelta(view: EditorView, scroller: HTMLElement): number {
  const cursor = view.coordsAtPos(view.state.selection.main.head);
  if (cursor === null) {
    return 0;
  }
  const { top, bottom } = scroller.getBoundingClientRect();
  const far = scroller.clientHeight / 2;
  if (cursor.bottom < top - far || cursor.top > bottom + far) {
    return Math.round((cursor.top + cursor.bottom - top - bottom) / 2);
  }
  if (cursor.top < top) {
    return Math.floor(cursor.top - top - MARGIN_PX);
  }
  if (cursor.bottom > bottom) {
    return Math.ceil(cursor.bottom - bottom + MARGIN_PX);
  }
  return 0;
}
