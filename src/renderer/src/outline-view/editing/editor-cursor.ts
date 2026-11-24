import type { EditorView } from "@codemirror/view";
import type {
  FieldRef,
  NodeCursor,
} from "@/renderer/src/outline/editing/cursor";

/** The field that the editor shows. A free editor of the pool has none. */
export type FieldOf = (view: EditorView) => FieldRef | undefined;

export function cursorOf(
  view: EditorView,
  fieldOf: FieldOf,
): NodeCursor | null {
  const ref = fieldOf(view);
  if (ref === undefined) {
    return null;
  }
  const { anchor, head } = view.state.selection.main;
  return { ...ref, anchor, head };
}

/** A key handler that gets the cursor. Does nothing in an editor without a field. */
export function onCursor(
  fieldOf: FieldOf,
  run: (cursor: NodeCursor, view: EditorView) => boolean,
): (view: EditorView) => boolean {
  return (view) => {
    const cursor = cursorOf(view, fieldOf);
    return cursor !== null && run(cursor, view);
  };
}

export function isAtStart({ anchor, head }: NodeCursor): boolean {
  return anchor === 0 && head === 0;
}
