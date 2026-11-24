import { describe, expect, it } from "vitest";
import {
  textChange,
  type TextChange,
} from "@/renderer/src/outline-view/editors/text-change";

function apply(text: string, change: TextChange): string {
  return text.slice(0, change.from) + change.insert + text.slice(change.to);
}

describe("textChange", () => {
  it("is null for equal texts", () => {
    expect(textChange("abc", "abc")).toBeNull();
  });

  it("finds an insertion", () => {
    expect(textChange("abc", "abXc")).toEqual({ from: 2, to: 2, insert: "X" });
  });

  it("finds a deletion", () => {
    expect(textChange("abXc", "abc")).toEqual({ from: 2, to: 3, insert: "" });
  });

  it("finds a replacement", () => {
    expect(textChange("hello world", "hello there")).toEqual({
      from: 6,
      to: 11,
      insert: "there",
    });
  });

  it("does not overlap prefix and suffix for repeated characters", () => {
    for (const [before, after] of [
      ["aaa", "aa"],
      ["aa", "aaa"],
      ["", "x"],
      ["x", ""],
      ["abab", "ab"],
    ]) {
      const change = textChange(before, after) as TextChange;
      expect(change.from).toBeLessThanOrEqual(change.to);
      expect(apply(before, change)).toBe(after);
    }
  });
});
