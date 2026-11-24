import { describe, expect, it } from "vitest";
import {
  parseInlineMarkdown,
  touchesSpan,
} from "@/renderer/src/markdown/inline-markdown";

/** Each span as `kind:text without markers`, with the URL of a link. */
function parse(text: string): string[] {
  return parseInlineMarkdown(text).spans.map((span) => {
    const [open, close] = span.markers;
    const inner =
      open === undefined
        ? text.slice(span.from, span.to)
        : text.slice(open.to, close.from);
    const url = span.url === undefined ? "" : ` -> ${span.url}`;
    return `${span.kind}:${inner}${url}`;
  });
}

describe("parseInlineMarkdown", () => {
  it.each([
    ["**b**", ["bold:b"]],
    ["__b__", ["bold:b"]],
    ["*i*", ["italic:i"]],
    ["_i_", ["italic:i"]],
    ["`c`", ["code:c"]],
    ["`` a`b ``", ["code: a`b "]],
    ["x **b** y *i* z", ["bold:b", "italic:i"]],
    ["***both***", ["italic:**both**", "bold:both"]],
    ["**a _b_ c**", ["bold:a _b_ c", "italic:b"]],
  ])("formats %s", (text, spans) => {
    expect(parse(text)).toEqual(spans);
  });

  it.each([
    "plain text",
    "** b **",
    "**b",
    "2 * 3 * 4",
    "snake_case_name",
    "\\*escaped\\*",
    "`open",
    "~~strike~~",
    "<b>html</b>",
    "![image](https://example.com)",
  ])("does not format %s", (text) => {
    expect(parse(text)).toEqual([]);
  });

  it.each([
    "# x",
    "- x",
    "* x",
    "1. x",
    "> x",
    "    x",
    "---",
    "***",
    "```",
    "[x] y",
    "[x]: y",
  ])("treats %j as plain text, not as a block", (text) => {
    expect(parse(text)).toEqual([]);
  });

  it.each(["# ", "- ", "1. ", "> ", "    ", "[ ] "])(
    "formats inline markdown after %j",
    (prefix) => {
      expect(parse(`${prefix}**b**`)).toEqual(["bold:b"]);
    },
  );

  it("does not format inside of code", () => {
    expect(parse("`**b** https://example.com`")).toEqual([
      "code:**b** https://example.com",
    ]);
  });

  it("has the positions of the markers", () => {
    expect(parseInlineMarkdown("a **b**").spans).toEqual([
      {
        kind: "bold",
        from: 2,
        to: 7,
        markers: [
          { from: 2, to: 4 },
          { from: 5, to: 7 },
        ],
        url: undefined,
      },
    ]);
  });

  it("parses each line on its own", () => {
    const { spans } = parseInlineMarkdown("a\n**b**\n*c\nd*");
    expect(spans.map(({ kind, from, to }) => [kind, from, to])).toEqual([
      ["bold", 2, 7],
    ]);
  });

  it.each([
    ["[docs](https://example.com)", ["link:docs -> https://example.com"]],
    ["[a](http://b.c/(d))", ["link:a -> http://b.c/(d)"]],
    ["[a](file:///Users/pavel)", ["link:a -> file:///Users/pavel"]],
    ["[a](<file:///my dir>)", ["link:a -> file:///my dir"]],
    ['[a](https://b.c "title")', ["link:a -> https://b.c"]],
    ["[a](https://b.c/\\))", ["link:a -> https://b.c/)"]],
    ["[a]()", ["link:a -> "]],
    ["[a](b)", ["link:a -> b"]],
    ["[a](www.example.com)", ["link:a -> www.example.com"]],
    ["[a](javascript:alert(1))", ["link:a -> javascript:alert(1)"]],
    ["[a](https://)", ["link:a -> https://"]],
    ["<mailto:a@b.c>", ["link:mailto:a@b.c -> mailto:a@b.c"]],
    ["[**a**](https://b.c)", ["link:**a** -> https://b.c", "bold:a"]],
    ["[https://a.b](https://c.d)", ["link:https://a.b -> https://c.d"]],
  ])("finds the link %s", (text, spans) => {
    expect(parse(text)).toEqual(spans);
  });

  it.each([
    "[a]",
    "[a][b]",
    "[a](b c)",
    "[](https://example.com)",
    "[ ](https://example.com)",
  ])("does not make a link of %s", (text) => {
    expect(parse(text)).toEqual([]);
  });

  it.each([
    ["https://example.com", "https://example.com"],
    ["see http://a.b/c?d=e#f now", "http://a.b/c?d=e#f"],
    ["file:///Users/pavel.", "file:///Users/pavel"],
    ["(https://a.b)", "https://a.b"],
    ["https://a.b/c_(d)", "https://a.b/c_(d)"],
    ["https://a.b/c_d_e, f", "https://a.b/c_d_e"],
    ["<https://a.b>", "https://a.b"],
    ["HTTPS://a.b!", "HTTPS://a.b"],
  ])("finds the bare URL of %s", (text, url) => {
    expect(parse(text)).toEqual([`link:${url} -> ${url}`]);
  });

  it.each(["xhttps://a.b", "https://", "ftp://a.b", "vscode://file"])(
    "does not make a link of %s",
    (text) => {
      expect(parse(text)).toEqual([]);
    },
  );

  it("finds a bare URL in bold text", () => {
    expect(parse("**https://a.b**")).toEqual([
      "bold:https://a.b",
      "link:https://a.b -> https://a.b",
    ]);
  });
});

describe("syntax", () => {
  it.each([
    ["a \\*b\\*", ["marker:\\", "marker:\\"]],
    ["~~a~~", ["marker:~~", "marker:~~"]],
    ["<b>a</b>", ["html:<b>", "html:</b>"]],
    ["<!-- a -->", ["html:<!-- a -->"]],
    ["<https://a.b>", ["marker:<", "marker:>"]],
    [
      "![a](https://b.c)",
      ["marker:![", "marker:]", "marker:(", "marker:)", "url:https://b.c"],
    ],
    ["[a][b]", ["marker:[", "marker:]", "url:[b]"]],
    ["C:\\dir 1 < 2 [ ] [x] ~a~", []],
    ["`\\*`", []],
  ])("highlights %s", (text, expected) => {
    const { syntax } = parseInlineMarkdown(text);
    expect(
      syntax.map(({ kind, from, to }) => `${kind}:${text.slice(from, to)}`),
    ).toEqual(expected);
  });

  it("formats inside of plain syntax", () => {
    expect(parse("~~**b**~~")).toEqual(["bold:b"]);
    expect(parse("<i>**b**</i>")).toEqual(["bold:b"]);
  });

  it("has the positions in the whole text", () => {
    expect(parseInlineMarkdown("a\n\\*").syntax).toEqual([
      { kind: "marker", from: 2, to: 3 },
    ]);
  });
});

describe("touchesSpan", () => {
  it("includes the boundaries of the span", () => {
    const span = { from: 2, to: 4 };
    const touching = [0, 1, 2, 3, 4, 5].filter((pos) =>
      touchesSpan(span, [{ from: pos, to: pos }]),
    );
    expect(touching).toEqual([2, 3, 4]);
  });

  it("checks whole selections", () => {
    const span = { from: 2, to: 4 };
    expect(touchesSpan(span, [{ from: 0, to: 9 }])).toBe(true);
    expect(touchesSpan(span, [{ from: 0, to: 1 }])).toBe(false);
    expect(touchesSpan(span, [])).toBe(false);
  });
});
