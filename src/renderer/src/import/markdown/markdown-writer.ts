import type { InlineSpan } from "@/renderer/src/markdown/inline-markdown";
import {
  isSpace,
  isWord,
  runEnd,
  type StyledLine,
} from "@/renderer/src/import/markdown/styled-line";

export interface WriteOptions {
  /** Write `_` for italic where possible. */
  underscores: boolean;
  /** Write a link with its URL as label without any markers. */
  bareUrls: boolean;
  /** Positions in the line that get a backslash. */
  escapes: ReadonlySet<number>;
}

export interface WrittenLine {
  markdown: string;
  /** The formatting that the markdown must have. */
  spans: Pick<InlineSpan, "kind" | "from" | "to" | "url">[];
  /** The position in the line of each character of `markdown`, -1 for a marker. */
  sources: number[];
}

type Style = "link" | "bold" | "italic";

export function writeLine(
  line: StyledLine,
  options: WriteOptions,
): WrittenLine {
  const { text, bold, italic, code, href } = line;
  const spans: WrittenLine["spans"] = [];
  const sources: number[] = [];
  let out = "";

  function marker(value: string): void {
    out += value;
    for (let i = 0; i < value.length; i++) {
      sources.push(-1);
    }
  }

  function literal(index: number, inLabel: boolean): void {
    const char = text[index];
    if (options.escapes.has(index) || (inLabel && /[[\]]/.test(char))) {
      marker("\\");
    }
    out += char;
    sources.push(index);
  }

  function addSpan(
    kind: InlineSpan["kind"],
    write: () => void,
    url?: string,
  ): void {
    const span = { kind, from: out.length, to: 0, url };
    spans.push(span);
    write();
    span.to = out.length;
  }

  function writeCode(from: number, to: number): void {
    const content = text.slice(from, to);
    const fence = codeFence(content);
    const padding = /^`|`$|^ .*[^ ].* $/.test(content) ? " " : "";
    addSpan("code", () => {
      marker(fence + padding);
      marker(content);
      marker(padding + fence);
    });
  }

  function writeEmphasis(
    kind: "bold" | "italic",
    from: number,
    to: number,
    open: ReadonlySet<Style>,
  ): void {
    const intraword = isWord(text[from - 1]) || isWord(text[to]);
    const underscore = kind === "italic" && options.underscores && !intraword;
    const italicMarker = underscore ? "_" : "*";
    const markers = kind === "bold" ? "**" : italicMarker;
    addSpan(kind, () => {
      marker(markers);
      writeRange(from, to, new Set([...open, kind]));
      marker(markers);
    });
  }

  function writeLink(from: number, to: number, open: ReadonlySet<Style>): void {
    const url = href[from] as string;
    if (options.bareUrls && text.slice(from, to) === url) {
      addSpan("link", () => marker(url), url);
      return;
    }
    const encoded = encodeUrl(url);
    addSpan(
      "link",
      () => {
        marker("[");
        writeRange(from, to, new Set([...open, "link"]));
        marker(`](${encoded})`);
      },
      encoded,
    );
  }

  /** The longest formatting that starts at `from`. */
  function outermost(
    from: number,
    to: number,
    open: ReadonlySet<Style>,
  ): { style: Style; end: number } | null {
    let best: { style: Style; end: number } | null = null;

    function consider(style: Style, values: readonly unknown[]): void {
      if (!values[from] || open.has(style)) {
        return;
      }
      let end = runEnd(values, from, to);
      while (isOutsideSpace(end - 1)) {
        end--;
      }
      if (best === null || end > best.end) {
        best = { style, end };
      }
    }

    function isOutsideSpace(i: number): boolean {
      return isSpace(text[i]) && !code[i];
    }

    // Overlapping formatting is split, and no part can start or end with a space.
    if (isOutsideSpace(from)) {
      return null;
    }
    consider("link", href);
    // The markdown parser reads `***` as bold in italic.
    consider("italic", italic);
    consider("bold", bold);
    return best;
  }

  function writeRange(
    from: number,
    to: number,
    open: ReadonlySet<Style>,
  ): void {
    let pos = from;
    while (pos < to) {
      const outer = outermost(pos, to, open);
      if (outer?.style === "link") {
        writeLink(pos, outer.end, open);
        pos = outer.end;
      } else if (outer !== null) {
        writeEmphasis(outer.style, pos, outer.end, open);
        pos = outer.end;
      } else if (code[pos]) {
        const end = plainEnd(pos, to, open);
        writeCode(pos, end);
        pos = end;
      } else {
        literal(pos, open.has("link"));
        pos++;
      }
    }
  }

  /** The end of the code that starts at `from`, before any formatting that starts in it. */
  function plainEnd(
    from: number,
    to: number,
    open: ReadonlySet<Style>,
  ): number {
    let end = from + 1;
    while (end < to && code[end] && outermost(end, to, open) === null) {
      end++;
    }
    return end;
  }

  writeRange(0, text.length, new Set());
  return { markdown: out, spans, sources };
}

function codeFence(content: string): string {
  const runs = new Set((content.match(/`+/g) ?? []).map((run) => run.length));
  let length = 1;
  while (runs.has(length)) {
    length++;
  }
  return "`".repeat(length);
}

/** Encodes the characters that would end a link destination. */
function encodeUrl(url: string): string {
  const special = hasBalancedParentheses(url) ? /[\s<>\\`]/g : /[\s<>\\`()]/g;
  return url.replace(special, percentEncode);
}

function percentEncode(char: string): string {
  // `encodeURIComponent` keeps parentheses.
  if (char === "(" || char === ")") {
    return char === "(" ? "%28" : "%29";
  }
  return encodeURIComponent(char);
}

function hasBalancedParentheses(url: string): boolean {
  let depth = 0;
  for (const char of url) {
    if (char === "(") {
      depth++;
    } else if (char === ")") {
      depth--;
    }
    if (depth < 0) {
      return false;
    }
  }
  return depth === 0;
}
