import type { HtmlRun } from "@/renderer/src/import/markdown/html-runs";

/** One line of text with the formatting of each character. */
export interface StyledLine {
  readonly text: string;
  readonly bold: boolean[];
  readonly italic: boolean[];
  readonly code: boolean[];
  readonly href: (string | null)[];
}

export type Emphasis = "bold" | "italic";

/** True for a line that is not only plain text. */
export function hasFormatting(runs: readonly HtmlRun[]): boolean {
  return runs.some((run) => run.bold || run.italic || run.code || run.href);
}

export function styledLine(runs: readonly HtmlRun[]): StyledLine {
  const line: StyledLine = {
    text: runs.map((run) => run.text).join(""),
    bold: [],
    italic: [],
    code: [],
    href: [],
  };
  for (const { text, bold, italic, code, href } of runs) {
    for (let i = 0; i < text.length; i++) {
      line.bold.push(bold);
      line.italic.push(italic);
      line.code.push(code);
      line.href.push(href);
    }
  }
  trimSpaces(line.href, null, line.text);
  trimSpaces(line.code, false, line.text);
  trimEmphasis(line, "bold");
  trimEmphasis(line, "italic");
  return line;
}

/** A copy without bold and italic. */
export function withoutEmphasis(line: StyledLine): StyledLine {
  return {
    ...line,
    bold: line.bold.map(() => false),
    italic: line.italic.map(() => false),
  };
}

export function withoutCode(line: StyledLine): StyledLine {
  return { ...line, code: line.code.map(() => false) };
}

/** The end of the run of equal values that starts at `from`, at most `to`. */
export function runEnd<T>(
  values: readonly T[],
  from: number,
  to: number,
): number {
  let end = from + 1;
  while (end < to && values[end] === values[from]) {
    end++;
  }
  return end;
}

function trimSpaces<T>(values: T[], none: T, text: string): void {
  const isSpaceAt = (i: number): boolean => isSpace(text[i]);
  trimRuns(values, none, isSpaceAt, isSpaceAt);
}

/** Markdown emphasis cannot start or end with a space, nor with punctuation next to a word. */
function trimEmphasis(line: StyledLine, style: Emphasis): void {
  const { text, code } = line;

  function isEdge(i: number, outside: number): boolean {
    if (code[i]) {
      return false;
    }
    return (
      isSpace(text[i]) || (isPunctuation(text[i]) && isWord(text[outside]))
    );
  }

  trimRuns(
    line[style],
    false,
    (i) => isEdge(i, i - 1),
    (i) => isEdge(i, i + 1),
  );
}

/** Sets the edges of each run of a value other than `none` to `none`. */
function trimRuns<T>(
  values: T[],
  none: T,
  trimStart: (index: number) => boolean,
  trimEnd: (index: number) => boolean,
): void {
  let from = 0;
  while (from < values.length) {
    const to = runEnd(values, from, values.length);
    if (values[from] !== none) {
      let start = from;
      while (start < to && trimStart(start)) {
        values[start++] = none;
      }
      let end = to;
      while (end > start && trimEnd(end - 1)) {
        values[--end] = none;
      }
    }
    from = to;
  }
}

export function isSpace(char: string): boolean {
  return /\s/.test(char);
}

function isPunctuation(char: string): boolean {
  return /[\p{P}\p{S}]/u.test(char);
}

export function isWord(char: string | undefined): boolean {
  return char !== undefined && !isSpace(char) && !isPunctuation(char);
}
