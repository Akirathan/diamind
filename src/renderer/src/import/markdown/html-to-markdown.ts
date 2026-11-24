import {
  parseInlineMarkdown,
  type InlineSpan,
} from "@/renderer/src/markdown/inline-markdown";
import {
  parseHtmlRuns,
  type HtmlRun,
} from "@/renderer/src/import/markdown/html-runs";
import {
  writeLine,
  type WriteOptions,
  type WrittenLine,
} from "@/renderer/src/import/markdown/markdown-writer";
import {
  hasFormatting,
  styledLine,
  withoutCode,
  withoutEmphasis,
  type StyledLine,
} from "@/renderer/src/import/markdown/styled-line";

/** The markdown parser can be slow for long lines with many markers. */
const MAX_PARSED_LENGTH = 20_000;
const MAX_ESCAPE_ROUNDS = 10;
const SPECIAL = /[\\`*_[\]!<]/;

/** The text of a node, which never has a line break. */
export function htmlToText(html: string): string {
  const runs = parseHtmlRuns(html).map((run) => ({
    ...run,
    text: run.text.replaceAll("\n", " "),
  }));
  return lineToMarkdown(runs);
}

export function htmlToNote(html: string): string {
  return splitLines(parseHtmlRuns(html)).map(lineToMarkdown).join("\n");
}

function splitLines(runs: readonly HtmlRun[]): HtmlRun[][] {
  const lines: HtmlRun[][] = [[]];
  for (const run of runs) {
    const parts = run.text.split("\n");
    parts.forEach((text, i) => {
      if (i > 0) {
        lines.push([]);
      }
      if (text !== "") {
        lines[lines.length - 1].push({ ...run, text });
      }
    });
  }
  return lines;
}

function lineToMarkdown(runs: readonly HtmlRun[]): string {
  if (!hasFormatting(runs)) {
    const text = runs.map((run) => run.text).join("");
    if (
      text.length > MAX_PARSED_LENGTH ||
      parseInlineMarkdown(text).spans.length === 0
    ) {
      return text;
    }
  }
  return formattedLineToMarkdown(styledLine(runs));
}

/** Tries several ways until the markdown parser finds exactly the wanted formatting. */
function formattedLineToMarkdown(line: StyledLine): string {
  const links = withoutCode(withoutEmphasis(line));
  if (line.text.length > MAX_PARSED_LENGTH) {
    return writeUnchecked(links);
  }
  return (
    tryWrite(line, { underscores: true, bareUrls: true }) ??
    tryWrite(line, { underscores: true, bareUrls: false }) ??
    tryWrite(line, { underscores: false, bareUrls: false }) ??
    tryWrite(withoutEmphasis(line), { underscores: false, bareUrls: false }) ??
    tryWrite(links, { underscores: false, bareUrls: false }) ??
    writeUnchecked(links)
  );
}

function writeUnchecked(line: StyledLine): string {
  const escapes = new Set<number>();
  return writeLine(line, { underscores: false, bareUrls: false, escapes })
    .markdown;
}

/** Returns `null` if the markdown would not have the wanted formatting. */
function tryWrite(
  line: StyledLine,
  options: Omit<WriteOptions, "escapes">,
): string | null {
  const escapes = new Set<number>();
  for (let round = 0; round < MAX_ESCAPE_ROUNDS; round++) {
    const written = writeLine(line, { ...options, escapes });
    const actual = parseInlineMarkdown(written.markdown).spans;
    const added = [
      ...literalMarkers(written, actual),
      // Formatting is missing if a literal character next to a marker joins it.
      ...(hasAllSpans(written, actual) ? [] : specialNeighbors(line, written)),
    ].filter((position) => !escapes.has(position));
    if (added.length > 0) {
      for (const position of added) {
        escapes.add(position);
      }
    } else {
      return hasExactlySpans(written, actual) ? written.markdown : null;
    }
  }
  return null;
}

/** The positions in the line of markers that are literal text. */
function literalMarkers(
  { sources }: WrittenLine,
  spans: readonly InlineSpan[],
): number[] {
  const positions: number[] = [];
  for (const { markers } of spans) {
    // Without its opening marker, a closing marker is plain text.
    const opening = markers[0];
    for (let i = opening?.from ?? 0; i < (opening?.to ?? 0); i++) {
      if (sources[i] >= 0) {
        positions.push(sources[i]);
      }
    }
  }
  return positions;
}

function specialNeighbors(
  { text }: StyledLine,
  { sources }: WrittenLine,
): number[] {
  const positions: number[] = [];
  sources.forEach((source, i) => {
    const atMarker = sources[i - 1] === -1 || sources[i + 1] === -1;
    if (source >= 0 && atMarker && SPECIAL.test(text[source])) {
      positions.push(source);
    }
  });
  return positions;
}

function hasAllSpans(
  { spans }: WrittenLine,
  actual: readonly InlineSpan[],
): boolean {
  const keys = new Set(actual.map(spanKey));
  return spans.every((span) => keys.has(spanKey(span)));
}

/** Bare URLs of the text become links, so they do not count. */
function hasExactlySpans(
  written: WrittenLine,
  actual: readonly InlineSpan[],
): boolean {
  const wanted = new Set(written.spans.map(spanKey));
  return (
    hasAllSpans(written, actual) &&
    actual.every(
      (span) => span.markers.length === 0 || wanted.has(spanKey(span)),
    )
  );
}

function spanKey({
  kind,
  from,
  to,
  url,
}: WrittenLine["spans"][number]): string {
  return `${kind} ${from} ${to} ${url ?? ""}`;
}
