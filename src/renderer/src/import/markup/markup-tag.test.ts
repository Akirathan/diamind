import { describe, expect, it } from "vitest";
import { parseTag } from "@/renderer/src/import/markup/markup-tag";

function attributes(source: string): Record<string, string> | undefined {
  const tag = parseTag(source, 0);
  return tag === null ? undefined : Object.fromEntries(tag.attributes);
}

describe("parseTag", () => {
  it("parses the kinds of tags", () => {
    expect(parseTag("x<b>", 1)).toMatchObject({
      name: "b",
      closing: false,
      selfClosing: false,
      end: 4,
    });
    expect(parseTag("</b >", 0)).toMatchObject({ name: "b", closing: true });
    expect(parseTag("<br/>", 0)).toMatchObject({ selfClosing: true, end: 5 });
  });

  it.each([
    [`<a b="c" d='e'>`, { b: "c", d: "e" }],
    [`<a b = "c>d</a>"/>`, { b: "c>d</a>" }],
    [`<a b="line\nbreak">`, { b: "line\nbreak" }],
    ["<a b=c d>", { b: "c", d: "" }],
    [`<a _note="" x:y="1">`, { _note: "", "x:y": "1" }],
    [`<a __proto__x="1">`, { __proto__x: "1" }],
  ])("parses the attributes of %j", (source, expected) => {
    expect(attributes(source)).toEqual(expected);
  });

  it.each([
    "<",
    "< b>",
    "<1>",
    "<b",
    '<b a="c>',
    "<b <i>",
    "<>",
    "</>",
    "<b =>",
  ])("does not parse %j", (source) => {
    expect(parseTag(source, 0)).toBeNull();
  });
});
