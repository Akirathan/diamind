import { decodeHtml } from "@/renderer/src/import/markup/entities";
import {
  parseTag,
  type MarkupTag,
} from "@/renderer/src/import/markup/markup-tag";

/** A part of a text with the same formatting. */
export interface HtmlRun {
  readonly text: string;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly code: boolean;
  /** The URL of a link. */
  readonly href: string | null;
}

const BOLD = new Set(["b", "strong"]);
const ITALIC = new Set(["i", "em"]);
const BLOCKS = new Set(
  "blockquote div dl dt dd h1 h2 h3 h4 h5 h6 hr li ol p pre table tr ul".split(
    " ",
  ),
);
/** Other tags are kept as text, e.g. `<T>`. */
const KNOWN_TAGS = new Set([
  ...BOLD,
  ...ITALIC,
  ...BLOCKS,
  ..."a abbr bdi bdo big cite code del dfn font ins kbd label mark mention q s samp small span strike sub sup tbody td th thead time tt u var wbr img br".split(
    " ",
  ),
]);

// All control characters but tab and line feed.
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b-\u001f\u007f]/g;

/** Reads the formatting of an HTML fragment. All other tags are dropped, but not their text. */
export function parseHtmlRuns(html: string): HtmlRun[] {
  const runs: HtmlRun[] = [];
  let bold = 0;
  let italic = 0;
  let code = 0;
  const hrefs: (string | null)[] = [];
  let pending = "";
  let atLineStart = true;
  let needsLineBreak = false;

  function flush(): void {
    if (pending !== "") {
      runs.push({
        text: pending,
        bold: bold > 0,
        italic: italic > 0,
        code: code > 0,
        href: hrefs.at(-1) ?? null,
      });
      pending = "";
    }
  }

  function addText(raw: string): void {
    const text = cleanText(decodeHtml(raw));
    if (text === "") {
      return;
    }
    if (needsLineBreak && !text.startsWith("\n")) {
      pending += "\n";
    }
    needsLineBreak = false;
    pending += text;
    atLineStart = text.endsWith("\n");
  }

  function applyTag(tag: MarkupTag): void {
    const name = tag.name.toLowerCase();
    if (name === "br") {
      addText("\n");
      return;
    }
    if (BLOCKS.has(name)) {
      needsLineBreak ||= !atLineStart;
      return;
    }
    if (tag.selfClosing) {
      return;
    }
    const delta = tag.closing ? -1 : 1;
    flush();
    if (BOLD.has(name)) {
      bold = Math.max(0, bold + delta);
    } else if (ITALIC.has(name)) {
      italic = Math.max(0, italic + delta);
    } else if (name === "code") {
      code = Math.max(0, code + delta);
    } else if (name === "a" && tag.closing) {
      hrefs.pop();
    } else if (name === "a") {
      hrefs.push(linkUrl(tag));
    }
  }

  let pos = 0;
  let textStart = 0;
  for (;;) {
    const next = html.indexOf("<", pos);
    if (next < 0) {
      break;
    }
    const tag = parseTag(html, next);
    if (tag === null || !KNOWN_TAGS.has(tag.name.toLowerCase())) {
      pos = next + 1;
      continue;
    }
    addText(html.slice(textStart, next));
    applyTag(tag);
    pos = tag.end;
    textStart = tag.end;
  }
  addText(html.slice(textStart));
  flush();
  return runs;
}

function linkUrl(tag: MarkupTag): string | null {
  const href = decodeHtml(tag.attributes.get("href") ?? "").trim();
  return href === "" ? null : href;
}

function cleanText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARACTERS, "")
    .replaceAll(" ", " ");
}
