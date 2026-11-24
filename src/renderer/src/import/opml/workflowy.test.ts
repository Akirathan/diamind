import { describe, expect, it } from "vitest";
import { parseWorkflowy } from "@/renderer/src/import/opml/workflowy";

const EXPORT = `<?xml version="1.0"?>
<opml version="2.0">
  <head>
    <ownerEmail>
      a@example.com
    </ownerEmail>
  </head>
  <body>
    <outline text="&lt;b&gt;Project&lt;/b&gt; R&amp;amp;D" _note="First &lt;i&gt;line&lt;/i&gt;&#10;second">
      <outline _complete="true" text="Done" />
      <outline text="" />
      <outline text="" />
    </outline>
    <outline text="See &lt;a href=&quot;https://example.com/?a=1&amp;amp;b=2&quot;&gt;docs&lt;/a&gt;&#10;now" />
  </body>
</opml>`;

describe("parseWorkflowy", () => {
  it("converts the nodes", () => {
    const empty = { text: "", note: "", completed: false, children: [] };
    expect(parseWorkflowy(EXPORT)).toEqual([
      {
        text: "**Project** R&D",
        note: "First _line_\nsecond",
        completed: false,
        children: [
          { text: "Done", note: "", completed: true, children: [] },
          empty,
          empty,
        ],
      },
      {
        ...empty,
        text: "See [docs](https://example.com/?a=1&b=2) now",
      },
    ]);
  });

  it("rejects a file without nodes", () => {
    expect(() => parseWorkflowy("<opml><body/></opml>")).toThrow("no nodes");
  });
});
