import { describe, expect, it } from "vitest";
import { createOutline, ROOT } from "@/renderer/src/outline/test-outline";
import {
  isVisible,
  nextVisible,
  previousVisible,
} from "@/renderer/src/outline/visible-nodes";

function setup() {
  const { store } = createOutline(`
    a
      a1
        a11
      a2
    b
      b1
    c
  `);
  store.setCollapsed("b", true);
  return store;
}

const VISIBLE = ["a", "a1", "a11", "a2", "b", "c"];

describe("previousVisible and nextVisible", () => {
  it("walk the visible nodes in document order", () => {
    const store = setup();
    VISIBLE.forEach((id, i) => {
      expect(previousVisible(store, ROOT, id)).toBe(VISIBLE[i - 1] ?? null);
      expect(nextVisible(store, ROOT, id)).toBe(VISIBLE[i + 1] ?? null);
    });
  });

  it("stay below the local root", () => {
    const store = setup();
    expect(previousVisible(store, "a", "a1")).toBeNull();
    expect(nextVisible(store, "a", "a2")).toBeNull();
    expect(previousVisible(store, "a", "a2")).toBe("a11");
  });
});

describe("isVisible", () => {
  it("is false below a collapsed node", () => {
    const store = setup();
    expect(isVisible(store, ROOT, "a11")).toBe(true);
    expect(isVisible(store, ROOT, "b")).toBe(true);
    expect(isVisible(store, ROOT, "b1")).toBe(false);
  });

  it("is false for the root, unknown nodes and nodes outside of the local root", () => {
    const store = setup();
    expect(isVisible(store, ROOT, ROOT)).toBe(false);
    expect(isVisible(store, ROOT, "x")).toBe(false);
    expect(isVisible(store, "a", "c")).toBe(false);
    expect(isVisible(store, "a", "a11")).toBe(true);
  });
});
