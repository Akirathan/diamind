import type { Range } from "@codemirror/state";
import { Decoration, type DecorationSet } from "@codemirror/view";
import {
  touchesSpan,
  type InlineMarkdown,
  type TextRange,
} from "@/renderer/src/markdown/inline-markdown";

export const LINK_URL_ATTRIBUTE = "data-link-url";

const hidden = Decoration.replace({});
const visibleMarker = Decoration.mark({
  class: "text-neutral-400 dark:text-neutral-500",
});
const syntaxStyles = {
  marker: visibleMarker,
  url: Decoration.mark({ class: "text-blue-600 dark:text-blue-400" }),
  html: Decoration.mark({ class: "text-rose-700 dark:text-rose-400" }),
};
const styles = {
  bold: Decoration.mark({ class: "font-bold" }),
  italic: Decoration.mark({ class: "italic" }),
  // `leading-none` keeps the other font from making the line higher.
  code: Decoration.mark({
    class:
      "rounded-sm bg-neutral-200 px-1 font-mono text-[0.9em] leading-none dark:bg-neutral-700",
  }),
};

/** `selection` is empty for an editor without focus. */
export function buildDecorations(
  { spans, syntax }: InlineMarkdown,
  selection: readonly TextRange[],
): DecorationSet {
  if (spans.length === 0 && syntax.length === 0) {
    return Decoration.none;
  }
  const decorations: Range<Decoration>[] = [];
  for (const span of spans) {
    const touched = touchesSpan(span, selection);
    const style =
      span.kind === "link" ? linkDecoration(span.url ?? "") : styles[span.kind];
    decorations.push(style.range(span.from, span.to));
    for (const marker of span.markers) {
      decorations.push(
        (touched ? visibleMarker : hidden).range(marker.from, marker.to),
      );
    }
  }
  for (const { kind, from, to } of syntax) {
    decorations.push(syntaxStyles[kind].range(from, to));
  }
  return Decoration.set(decorations, true);
}

function linkDecoration(url: string): Decoration {
  return Decoration.mark({
    class:
      "text-blue-600 underline dark:text-blue-400 [[data-open-link-key]_&]:cursor-pointer",
    attributes: { [LINK_URL_ATTRIBUTE]: url },
  });
}
