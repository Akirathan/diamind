import {
  EditorSelection,
  EditorState,
  StateEffect,
  StateField,
  type Extension,
  type Transaction,
  type TransactionSpec,
} from "@codemirror/state";
import { EditorView, type DecorationSet } from "@codemirror/view";
import { buildDecorations } from "@/renderer/src/markdown/decorations";
import {
  parseInlineMarkdown,
  touchesSpan,
  type InlineMarkdown,
  type TextRange,
} from "@/renderer/src/markdown/inline-markdown";

export const setFocused = StateEffect.define<boolean>();
/** Markers that appear under a pressed mouse would move the text, and the mouse would select it. */
export const setMouseDown = StateEffect.define<boolean>();

interface Preview {
  readonly focused: boolean;
  readonly mouseDown: boolean;
  readonly markdown: InlineMarkdown;
  /** The markers of spans that touch it are visible. */
  readonly selection: readonly TextRange[];
  readonly decorations: DecorationSet;
}

export const previewField = StateField.define<Preview>({
  create: (state) =>
    show(parseInlineMarkdown(state.doc.toString()), [], false, false),
  update: updatePreview,
  provide: (field) =>
    EditorView.decorations.from(field, (preview) => preview.decorations),
});

function show(
  markdown: InlineMarkdown,
  selection: readonly TextRange[],
  focused: boolean,
  mouseDown: boolean,
): Preview {
  const decorations = buildDecorations(markdown, selection);
  return { markdown, selection, focused, mouseDown, decorations };
}

function updatePreview(preview: Preview, tr: Transaction): Preview {
  let { focused, mouseDown, markdown } = preview;
  for (const effect of tr.effects) {
    if (effect.is(setFocused)) {
      focused = effect.value;
    } else if (effect.is(setMouseDown)) {
      mouseDown = effect.value;
    }
  }
  if (tr.docChanged) {
    markdown = parseInlineMarkdown(tr.newDoc.toString());
    mouseDown = false;
  }
  if (mouseDown) {
    return { ...preview, focused, mouseDown };
  }
  const selection = focused ? tr.newSelection.ranges : [];
  if (
    focused === preview.focused &&
    mouseDown === preview.mouseDown &&
    markdown === preview.markdown &&
    (markdown.spans.length === 0 || selection === preview.selection)
  ) {
    return preview;
  }
  return show(markdown, selection, focused, mouseDown);
}

/** The position at the outer side of the hidden markers around `pos`. */
function outsideHiddenMarkers(preview: Preview, pos: number): number {
  const hiding = preview.markdown.spans.filter(
    (span) => span.markers.length > 0 && !touchesSpan(span, preview.selection),
  );
  // Inner spans come last and have to be left first.
  for (const span of hiding.reverse()) {
    const [open, close] = span.markers;
    if (pos > open.from && pos <= open.to) {
      pos = open.from;
    } else if (pos >= close.from && pos < close.to) {
      pos = close.to;
    }
  }
  return pos;
}

/**
 * A click behind `**bold**` hits the position before the hidden `**`, and so
 * does a cursor movement to the end of the line. Text typed there would be bold.
 */
function moveCursorOutsideHiddenMarkers(
  tr: Transaction,
): Transaction | readonly TransactionSpec[] {
  if (tr.docChanged || !tr.isUserEvent("select")) {
    return tr;
  }
  const { ranges, main } = tr.newSelection;
  if (ranges.length > 1 || !main.empty) {
    return tr;
  }
  const pos = outsideHiddenMarkers(
    tr.startState.field(previewField),
    main.head,
  );
  return pos === main.head
    ? tr
    : [tr, { selection: EditorSelection.cursor(pos) }];
}

export const previewState: Extension = [
  previewField,
  EditorState.transactionFilter.of(moveCursorOutsideHiddenMarkers),
];
