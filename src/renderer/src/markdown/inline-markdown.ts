import type { SyntaxNode } from "@lezer/common";
import { parser, type InlineContext } from "@lezer/markdown";
import { parseLinkUrl } from "@/shared/link-url";

export interface TextRange {
  readonly from: number;
  readonly to: number;
}

/** A formatted part of a text, including its markers. */
export interface InlineSpan extends TextRange {
  readonly kind: "bold" | "italic" | "code" | "link";
  readonly markers: readonly TextRange[];
  /** Only for links. */
  readonly url?: string;
}

const BARE_URL = /(?:https?|file):\/\/[^\s<>[\]`]+/iy;
const TRAILING_PUNCTUATION = `?!.,:;*_~'"`;

/** The default parser without its block syntax, so `# x` or `- x` stay plain text. */
const inlineParser = parser.configure({
  remove: [
    "LinkReference",
    "IndentedCode",
    "FencedCode",
    "Blockquote",
    "HorizontalRule",
    "BulletList",
    "OrderedList",
    "ATXHeading",
    "HTMLBlock",
    "SetextHeading",
    "Entity",
    "HTMLTag",
    "HardBreak",
  ],
  defineNodes: ["BareUrl"],
  parseInline: [{ name: "BareUrl", parse: parseBareUrl }],
});

/** Most texts have no markdown. */
const MAYBE_MARKDOWN = /[*_`[]|:\/\//;

/** The spans of bold, italic, inline code and links, outer spans before inner ones. */
export function parseInlineMarkdown(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  if (!MAYBE_MARKDOWN.test(text)) {
    return spans;
  }
  let offset = 0;
  for (const line of text.split("\n")) {
    parseLine(line, offset, spans);
    offset += line.length + 1;
  }
  return spans;
}

function parseLine(line: string, offset: number, spans: InlineSpan[]): void {
  let linkEnd = 0;

  function add(
    node: TextRange,
    kind: InlineSpan["kind"],
    markers: readonly TextRange[],
    url?: string,
  ) {
    spans.push({
      kind,
      from: node.from + offset,
      to: node.to + offset,
      markers: markers.map(({ from, to }) => ({
        from: from + offset,
        to: to + offset,
      })),
      url,
    });
  }

  inlineParser.parse(line).iterate({
    enter(ref) {
      switch (ref.name) {
        case "StrongEmphasis":
          add(ref, "bold", outerChildren(ref.node));
          return true;
        case "Emphasis":
          add(ref, "italic", outerChildren(ref.node));
          return true;
        case "InlineCode":
          add(ref, "code", outerChildren(ref.node));
          return false;
        case "Link": {
          const link = parseLink(ref.node, line);
          if (link !== null) {
            add(ref, "link", link.markers, link.url);
            linkEnd = ref.to;
          }
          return true;
        }
        case "BareUrl":
          if (ref.from >= linkEnd) {
            add(ref, "link", [], line.slice(ref.from, ref.to));
          }
          return false;
        case "Image":
          return false;
        default:
          return true;
      }
    },
  });
}

function outerChildren(node: SyntaxNode): TextRange[] {
  const { firstChild, lastChild } = node;
  return firstChild === null || lastChild === null
    ? []
    : [firstChild, lastChild];
}

/** `null` if the link cannot be opened or if nothing of it would be visible without its markers. */
function parseLink(
  node: SyntaxNode,
  line: string,
): { url: string; markers: TextRange[] } | null {
  const [open, close] = node.getChildren("LinkMark");
  const destination = node.getChild("URL");
  if (
    destination === null ||
    line.slice(open.to, close.from).trim().length === 0
  ) {
    return null;
  }
  const url = line
    .slice(destination.from, destination.to)
    .replace(/^<(.*)>$/, "$1")
    .replace(/\\([!-/:-@[-`{-~])/g, "$1");
  if (parseLinkUrl(url) === null) {
    return null;
  }
  return { url, markers: [open, { from: close.from, to: node.to }] };
}

function parseBareUrl(cx: InlineContext, next: number, pos: number): number {
  const isFirstChar =
    next === 72 || next === 104 || next === 70 || next === 102; // H h F f
  const start = pos - cx.offset;
  if (!isFirstChar || /\w/.test(cx.text.charAt(start - 1))) {
    return -1;
  }
  BARE_URL.lastIndex = start;
  const match = BARE_URL.exec(cx.text);
  if (match === null) {
    return -1;
  }
  const url = trimUrl(match[0]);
  if (parseLinkUrl(url) === null) {
    return -1;
  }
  return cx.addElement(cx.elt("BareUrl", pos, pos + url.length));
}

/** Drops punctuation and unbalanced parentheses that belong to the sentence around the URL. */
function trimUrl(url: string): string {
  let unbalanced = url.split(")").length - url.split("(").length;
  let end = url.length;
  for (; end > 0; end--) {
    const last = url[end - 1];
    if (last === ")" && unbalanced > 0) {
      unbalanced--;
    } else if (!TRAILING_PUNCTUATION.includes(last)) {
      break;
    }
  }
  return url.slice(0, end);
}
