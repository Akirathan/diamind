import type { SyntaxNode } from "@lezer/common";
import { parser, Strikethrough, type InlineContext } from "@lezer/markdown";
import { parseLinkUrl } from "@/shared/link-url";

export interface TextRange {
  readonly from: number;
  readonly to: number;
}

/** A formatted part of a text, including its markers. */
export interface InlineSpan extends TextRange {
  readonly kind: "bold" | "italic" | "code" | "link";
  readonly markers: readonly TextRange[];
  /** Only for links. It can be invalid. */
  readonly url?: string;
}

/** A part of the text that is always visible and only has another color. */
export interface SyntaxRange extends TextRange {
  readonly kind: "marker" | "url" | "html";
}

export interface InlineMarkdown {
  /** Outer spans come before inner ones. */
  readonly spans: readonly InlineSpan[];
  readonly syntax: readonly SyntaxRange[];
}

const NO_MARKDOWN: InlineMarkdown = { spans: [], syntax: [] };

const BARE_URL = /(?:https?|file):\/\/[^\s<>[\]`]+/iy;
const TRAILING_PUNCTUATION = `?!.,:;*_~'"`;

/** The default parser without its block syntax, so `# x` or `- x` stay plain text. */
const inlineParser = parser.configure([
  Strikethrough,
  {
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
      "HardBreak",
    ],
    defineNodes: ["BareUrl"],
    parseInline: [{ name: "BareUrl", parse: parseBareUrl }],
  },
]);

/** Most texts have no markdown. */
const MAYBE_MARKDOWN = /[*_`[<\\]|~~|:\/\//;

export function parseInlineMarkdown(text: string): InlineMarkdown {
  if (!MAYBE_MARKDOWN.test(text)) {
    return NO_MARKDOWN;
  }
  const spans: InlineSpan[] = [];
  const syntax: SyntaxRange[] = [];
  let offset = 0;
  for (const line of text.split("\n")) {
    parseLine(line, offset, spans, syntax);
    offset += line.length + 1;
  }
  return { spans, syntax };
}

/** True if the cursor or a selection is inside of the span or at its boundary. */
export function touchesSpan(
  span: TextRange,
  selection: readonly TextRange[],
): boolean {
  return selection.some(
    (range) => range.from <= span.to && range.to >= span.from,
  );
}

function parseLine(
  line: string,
  offset: number,
  spans: InlineSpan[],
  syntax: SyntaxRange[],
): void {
  let linkEnd = 0;

  function shift({ from, to }: TextRange): TextRange {
    return { from: from + offset, to: to + offset };
  }

  function addSpan(
    node: TextRange,
    kind: InlineSpan["kind"],
    markers: readonly TextRange[],
    url?: string,
  ) {
    spans.push({ ...shift(node), kind, markers: markers.map(shift), url });
  }

  function addSyntax(
    kind: SyntaxRange["kind"],
    ranges: readonly (TextRange | null)[],
  ) {
    for (const range of ranges) {
      if (range !== null) {
        syntax.push({ ...shift(range), kind });
      }
    }
  }

  function enterLink(node: SyntaxNode): boolean {
    const marks = node.getChildren("LinkMark");
    const label = node.getChild("LinkLabel");
    if (marks.length === 4 && hasVisibleLabel(marks, line)) {
      const tail = { from: marks[1].from, to: node.to };
      addSpan(node, "link", [marks[0], tail], linkUrl(node, line));
      linkEnd = node.to;
    } else if (label !== null) {
      addSyntax("marker", marks);
      addSyntax("url", [label]);
    }
    return true;
  }

  inlineParser.parse(line).iterate({
    enter(ref) {
      const { node } = ref;
      switch (ref.name) {
        case "StrongEmphasis":
          addSpan(ref, "bold", outerChildren(node));
          return true;
        case "Emphasis":
          addSpan(ref, "italic", outerChildren(node));
          return true;
        case "InlineCode":
          addSpan(ref, "code", outerChildren(node));
          return false;
        case "Link":
          return enterLink(node);
        case "Autolink": {
          const url = node.getChild("URL");
          if (url !== null && ref.from >= linkEnd) {
            addSyntax("marker", node.getChildren("LinkMark"));
            addSpan(url, "link", [], line.slice(url.from, url.to));
          }
          return false;
        }
        case "BareUrl":
          if (ref.from >= linkEnd) {
            addSpan(ref, "link", [], line.slice(ref.from, ref.to));
          }
          return false;
        case "Image":
          addSyntax("marker", node.getChildren("LinkMark"));
          addSyntax("url", [node.getChild("URL"), node.getChild("LinkLabel")]);
          return false;
        case "Strikethrough":
          addSyntax("marker", outerChildren(node));
          return true;
        case "Escape":
          addSyntax("marker", [{ from: ref.from, to: ref.from + 1 }]);
          return false;
        case "HTMLTag":
        case "Comment":
        case "ProcessingInstruction":
          addSyntax("html", [ref]);
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

/** False if nothing of the link would be visible without its markers. */
function hasVisibleLabel([open, close]: TextRange[], line: string): boolean {
  return line.slice(open.to, close.from).trim().length > 0;
}

function linkUrl(node: SyntaxNode, line: string): string {
  const destination = node.getChild("URL");
  if (destination === null) {
    return "";
  }
  return line
    .slice(destination.from, destination.to)
    .replace(/^<(.*)>$/, "$1")
    .replace(/\\([!-/:-@[-`{-~])/g, "$1");
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
