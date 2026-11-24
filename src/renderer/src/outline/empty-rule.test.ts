import { describe, expect, it } from "vitest";
import type { Node } from "@/shared/outline/node";
import { isEmptyNode } from "@/renderer/src/outline/empty-rule";
import { testNode } from "@/renderer/src/outline/test-outline";

const empty = testNode("e", "root", "a0", "");

describe("isEmptyNode", () => {
  it("is true for a text node without text and note", () => {
    expect(isEmptyNode(empty)).toBe(true);
  });

  it("is false with text or note", () => {
    expect(isEmptyNode({ ...empty, text: "t" })).toBe(false);
    expect(isEmptyNode({ ...empty, note: "n" })).toBe(false);
  });

  it("is false for a divider without text", () => {
    expect(isEmptyNode({ ...empty, format: "divider" })).toBe(false);
  });

  it("is false for an attachment node", () => {
    const attachment: Node = {
      ...empty,
      type: "attachment",
      attachmentId: "file",
    };
    expect(isEmptyNode(attachment)).toBe(false);
  });
});
