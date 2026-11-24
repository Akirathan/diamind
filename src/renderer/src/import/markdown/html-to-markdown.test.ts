import { describe, expect, it } from "vitest";
import {
  htmlToNote,
  htmlToText,
} from "@/renderer/src/import/markdown/html-to-markdown";
import { parseHtmlRuns } from "@/renderer/src/import/markdown/html-runs";
import { parseInlineMarkdown } from "@/renderer/src/markdown/inline-markdown";

describe("htmlToText", () => {
  it.each([
    ["<b>b</b>", "**b**"],
    ["<strong>b</strong>", "**b**"],
    ["<i>i</i>", "_i_"],
    ["<em>i</em>", "_i_"],
    ["<B>b</B>", "**b**"],
    ["<code>c</code>", "`c`"],
    ["<b>a <i>b</i> c</b>", "**a _b_ c**"],
    ["<b><i>both</i></b>", "_**both**_"],
    ["<b>a</b><b>b</b>", "**ab**"],
    ["<b>a</b><i>b</i>", "**a***b*"],
    ["a<i>b</i>c", "a*b*c"],
    ["a<b><i>b</i></b>c", "a***b***c"],
    ["<b>a <i>b</b> c</i>", "**a _b_** _c_"],
    ["<b><code>c</code></b>", "**`c`**"],
    ["<b>open", "**open**"],
    ["close</b>", "close"],
  ])("converts the formatting of %s", (html, markdown) => {
    expect(htmlToText(html)).toBe(markdown);
  });

  it.each([
    ["<b> a </b>b", " **a** b"],
    ["a<b> </b>b", "a b"],
    ["<b></b>a", "a"],
    ["<b>Key:</b>value", "**Key**:value"],
    ["a<b>(b)</b>", "a(**b)**"],
    ["<code> a </code>", " `a` "],
    ["<code>a`b</code>", "``a`b``"],
    ["<code>`a</code>", "`` `a ``"],
    ["<code>*a* &lt;b&gt;</code>", "`*a* <b>`"],
  ])("moves the markers of %s where they work", (html, markdown) => {
    expect(htmlToText(html)).toBe(markdown);
  });

  it.each([
    ['<a href="https://a.b">x</a>', "[x](https://a.b)"],
    ["<a href='https://a.b'>x</a>", "[x](https://a.b)"],
    ['<a href="https://a.b/?c=1&amp;d=2">x</a>', "[x](https://a.b/?c=1&d=2)"],
    ['<a href="https://a.b">https://a.b</a>', "https://a.b"],
    ['<a href="https://a.b">https://a.b</a>c', "[https://a.b](https://a.b)c"],
    ['<a href="https://a.b/c d">x</a>', "[x](https://a.b/c%20d)"],
    ['<a href="https://a.b/c_(d)">x</a>', "[x](https://a.b/c_(d))"],
    ['<a href="https://a.b/(">x</a>', "[x](https://a.b/%28)"],
    ['<a href="https://a.b">[x]</a>', "[\\[x\\]](https://a.b)"],
    ['<a href="https://a.b"><b>x</b></a>', "[**x**](https://a.b)"],
    ['<b>x <a href="https://a.b">y</a> z</b>', "**x [y](https://a.b) z**"],
    ['!<a href="https://a.b">x</a>', "\\![x](https://a.b)"],
    ['<a href="https://a.b"> x </a>y', " [x](https://a.b) y"],
    ['<a href="">x</a>', "x"],
    ["<a>x</a>", "x"],
    ['<a href="https://a.b"></a>x', "x"],
    ['<a href="javascript:alert(1)">x</a>', "[x](javascript:alert(1))"],
  ])("converts the link %s", (html, markdown) => {
    expect(htmlToText(html)).toBe(markdown);
  });

  it.each([
    ["<u>a</u> <s>b</s> <strike>c</strike>", "a b c"],
    ['<span class="colored c-red">a</span>', "a"],
    ['<mention id="1" by="2">@Pavel</mention>', "@Pavel"],
    ['<time startYear="2026">Mon, Nov 23</time>', "Mon, Nov 23"],
    ['<span class="contentTag">#<span>tag</span></span>', "#tag"],
    ["<script>alert(1)</script>", "<script>alert(1)</script>"],
    ["<img src=x onerror=alert(1)>a", "a"],
    ["List<T> and a < b > c <3", "List<T> and a < b > c <3"],
    ["&lt;b&gt;a&lt;/b&gt;", "<b>a</b>"],
    ["a&nbsp;b&hellip; R&amp;D", "a b… R&D"],
    ["a\u0000\u0007b", "ab"],
  ])("keeps the text of %s", (html, markdown) => {
    expect(htmlToText(html)).toBe(markdown);
  });

  it.each([
    ["*a*", "\\*a*"],
    ["**a**", "\\*\\*a**"],
    ["_a_ and _b_", "\\_a_ and \\_b_"],
    ["`a`", "\\`a`"],
    ["[a](b)", "\\[a](b)"],
    ["*x <b>y</b> z*", "\\*x **y** z*"],
    ["\\<b>a</b>", "\\\\**a**"],
  ])("escapes the markdown of %s", (html, markdown) => {
    expect(htmlToText(html)).toBe(markdown);
  });

  it.each([
    "snake_case_name",
    "2 * 3 * 4",
    "# a",
    "- a",
    "1. a",
    "[ ] a",
    "[x] a",
    "~~a~~",
    "\\d+\\.",
    "C:\\dir",
    "https://a.b/c_d_e",
    "lonely * and ` and _",
  ])("does not escape %s", (text) => {
    expect(htmlToText(text)).toBe(text);
  });

  it("replaces line breaks by spaces", () => {
    expect(htmlToText("a\nb\r\nc<br>d<br/>e")).toBe("a b c d e");
    expect(htmlToText("<b>a\nb</b>")).toBe("**a b**");
  });

  it("drops code that markdown cannot express", () => {
    expect(htmlToText("a`<code>b</code>")).toBe("a`b");
  });

  it("does not parse very long lines", () => {
    const text = "*a* ".repeat(50_000);
    expect(htmlToText(text)).toBe(text);
    expect(htmlToText(`<b>${text}</b>`)).toBe(text);
    const link = `<a href="https://a.b">x</a>`;
    expect(htmlToText(text + link)).toBe(`${text}[x](https://a.b)`);
  });

  it.each(["<a ", '<a "', "<b>", "</a>", "&amp;", "&#", "[", "`"])(
    "handles many %s",
    (part) => {
      expect(() => htmlToText(part.repeat(100_000))).not.toThrow();
    },
  );
});

describe("htmlToNote", () => {
  it.each([
    ["a\nb\r\nc", "a\nb\nc"],
    ["a<br>b<br/><br />c", "a\nb\n\nc"],
    ["<p>a</p><p>b</p>c", "a\nb\nc"],
    ["<div>a<div>b</div></div>", "a\nb"],
    ["<ul><li>a</li><li>b</li></ul>", "a\nb"],
    ["<b>a\nb</b>", "**a**\n**b**"],
    ['<a href="https://a.b">x\ny</a>', "[x](https://a.b)\n[y](https://a.b)"],
    ["*a*\n\n b", "\\*a*\n\n b"],
    ["", ""],
  ])("converts %j", (html, markdown) => {
    expect(htmlToNote(html)).toBe(markdown);
  });
});

/** Deterministic pseudo random numbers. */
function randomSource(): (limit: number) => number {
  let state = 1;
  return (limit) => {
    state = Math.imul(state ^ (state >>> 15), 0x2c1b3c6d) + 0x6d2b79f5;
    state = Math.imul(state ^ (state >>> 12), 0x297a2d39);
    return (state >>> 8) % limit;
  };
}

describe("a conversion of generated HTML", () => {
  const random = randomSource();
  const texts = ["a", "word ", " ", ".", "(b)", "*", "_", "[", "]", "\\", "č"];
  const tags = ["b", "i", "u", "code", 'a href="https://x.y/"'];

  function generate(depth: number): string {
    let html = "";
    for (let i = random(4) + 2; i > 0; i--) {
      if (depth > 0 && random(3) === 0) {
        const tag = tags[random(tags.length)];
        html += `<${tag}>${generate(depth - 1)}</${tag.split(" ")[0]}>`;
      } else {
        html += texts[random(texts.length)];
      }
    }
    return html;
  }

  /** The text without formatting markers, backslashes and spaces. */
  function visibleText(markdown: string): string {
    const hidden = new Set<number>();
    for (const { markers } of parseInlineMarkdown(markdown).spans) {
      for (const { from, to } of markers) {
        for (let i = from; i < to; i++) {
          hidden.add(i);
        }
      }
    }
    const visible = [...markdown].filter((_char, i) => !hidden.has(i));
    return visible.join("").replace(/[\\ ]/g, "");
  }

  it("keeps the text and the links", () => {
    for (let i = 0; i < 2000; i++) {
      const html = generate(3);
      const runs = parseHtmlRuns(html);
      const text = runs.map((run) => run.text).join("");
      const markdown = htmlToText(html);
      // Code that starts or ends with a backtick is padded with spaces.
      expect(visibleText(markdown), html).toBe(text.replace(/[\\ ]/g, ""));
      const hasLink = runs.some((run) => run.href && run.text.trim() !== "");
      const { spans } = parseInlineMarkdown(markdown);
      expect(
        spans.some((span) => span.kind === "link"),
        html,
      ).toBe(hasLink);
    }
  });
});
