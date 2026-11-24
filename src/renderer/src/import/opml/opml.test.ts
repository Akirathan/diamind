import { describe, expect, it } from "vitest";
import { ImportError } from "@/renderer/src/import/opml/import-error";
import {
  parseOpml,
  type OpmlLimits,
  type OpmlOutline,
} from "@/renderer/src/import/opml/opml";

function file(body: string): string {
  return `<?xml version="1.0"?>
<opml version="2.0">
  <head><ownerEmail>a@b.c</ownerEmail></head>
  <body>${body}</body>
</opml>
`;
}

/** The texts, with the children in brackets. */
function texts(outlines: readonly OpmlOutline[]): string {
  return outlines
    .map(({ text, children }) =>
      children.length === 0 ? text : `${text}(${texts(children)})`,
    )
    .join(" ");
}

function parsed(body: string, limits?: OpmlLimits): string {
  return texts(parseOpml(file(body), limits));
}

describe("parseOpml", () => {
  it("keeps the tree and the order", () => {
    expect(
      parsed(`
        <outline text="a">
          <outline text="b" />
          <outline text="c"><outline text="d"></outline></outline>
        </outline>
        <outline text="e"/>`),
    ).toBe("a(b c(d)) e");
  });

  it("reads the note and the completed state", () => {
    const [a, b] = parseOpml(
      file(
        `<outline text="a" _note="n &amp;amp; &lt;b&gt;" _complete="true"/>
         <outline text="b" _complete="false"/>`,
      ),
    );
    expect(a).toMatchObject({ note: "n &amp; <b>", completed: true });
    expect(b).toMatchObject({ note: "", completed: false });
  });

  it("keeps escaped and plain line breaks", () => {
    const [node] = parseOpml(file(`<outline _note="a&#10;b\nc"/>`));
    expect(node).toMatchObject({ text: "", note: "a\nb\nc" });
  });

  it("reads tags in an attribute value as text", () => {
    expect(parsed(`<outline text="</outline> > <x"/>`)).toBe("</outline> > <x");
  });

  it("ignores comments, CDATA sections and other elements", () => {
    expect(
      parsed(
        `<!-- <outline text="x"/> --><![CDATA[<outline text="y"/>]]>
         <other><outline text="a"><other/></outline></other> text`,
      ),
    ).toBe("a");
  });

  it("ignores outlines outside of the body", () => {
    const source = file("").replace("<head>", '<head><outline text="x"/>');
    expect(parseOpml(source)).toEqual([]);
  });

  it("accepts a byte order mark and Windows line breaks", () => {
    const source = `\ufeff${file('<outline text="a"/>')}`;
    expect(texts(parseOpml(source.replaceAll("\n", "\r\n")))).toBe("a");
  });

  it.each([
    "",
    "plain text",
    "text <opml></opml>",
    "{}",
    "<html><body></body></html>",
    "<opml><body>",
    "<opml><body></opml></body>",
    "<opml></opml><opml></opml>",
    "<opml></opml> text",
    "</opml>",
    file('<outline text="a">'),
    file('<outline text="a"></outline></outline>'),
    file('<outline text="a'),
    file('<outline text="a" <outline/>'),
    file("<!-- comment"),
    file("<![CDATA["),
    file("<outline text='a'/>").slice(0, 100),
  ])("rejects the malformed file %j", (source) => {
    expect(() => parseOpml(source)).toThrow(ImportError);
  });

  it("rejects document types, so there are no custom entities", () => {
    const doctype = `<!DOCTYPE opml [<!ENTITY x SYSTEM "file:///etc/passwd">]>`;
    const source = file('<outline text="&x;"/>').replace("?>", `?>${doctype}`);
    expect(() => parseOpml(source)).toThrow("document type");
  });

  it("limits the number of nodes", () => {
    const limits = { maxDepth: 5, maxNodes: 3 };
    expect(parsed("<outline/>".repeat(3), limits)).toBe("  ");
    expect(() => parsed("<outline/>".repeat(4), limits)).toThrow(
      "more than 3 nodes",
    );
  });

  it("limits the depth", () => {
    function nested(depth: number): string {
      return "<outline>".repeat(depth) + "</outline>".repeat(depth);
    }
    const limits = { maxDepth: 5, maxNodes: 1000 };
    expect(() => parsed(nested(5), limits)).not.toThrow();
    expect(() => parsed(nested(6), limits)).toThrow("more than 5 levels");
    expect(() => parsed(nested(500))).not.toThrow();
    expect(() => parsed(nested(200_000))).toThrow(ImportError);
  });
});
