import { describe, expect, it } from "vitest";
import { decodeHtml, decodeXml } from "@/renderer/src/import/markup/entities";

describe("decodeXml", () => {
  it.each([
    ["a &amp; b", "a & b"],
    ["&lt;b&gt;", "<b>"],
    ["&quot;&apos;", `"'`],
    ["&#10;&#x41;&#X1F600;", "\nA😀"],
    ["&amp;lt;", "&lt;"],
    ["&nbsp; &unknown; & &;", "&nbsp; &unknown; & &;"],
    ["&#0;&#xD800;&#x110000;", "\ufffd\ufffd\ufffd"],
  ])("decodes %s", (text, expected) => {
    expect(decodeXml(text)).toBe(expected);
  });
});

describe("decodeHtml", () => {
  it.each([
    ["a&nbsp;b", "a\u00a0b"],
    ["&hellip;&mdash;&euro;", "…—€"],
    ["&amp;nbsp;", "&nbsp;"],
    ["&unknown;", "&unknown;"],
  ])("decodes %s", (text, expected) => {
    expect(decodeHtml(text)).toBe(expected);
  });
});
