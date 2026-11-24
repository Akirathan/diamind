import { describe, expect, it } from "vitest";
import {
  createOutline,
  ROOT,
} from "@/renderer/src/outline/fixtures/test-outline";
import {
  isVisible,
  nextVisible,
  previousVisible,
} from "@/renderer/src/outline/editing/visible-nodes";

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
    expect(previousVisible(store, "a", "a1")).toBe("a");
    expect(previousVisible(store, "a", "a")).toBeNull();
    expect(nextVisible(store, "a", "a2")).toBeNull();
    expect(previousVisible(store, "a", "a2")).toBe("a11");
  });

  it("go from a collapsed local root to its children", () => {
    const store = setup();
    expect(nextVisible(store, "b", "b")).toBe("b1");
    expect(nextVisible(store, "c", "c")).toBeNull();
  });
});

describe("isVisible", () => {
  it("is false below a collapsed node", () => {
    const store = setup();
    expect(isVisible(store, ROOT, "a11")).toBe(true);
    expect(isVisible(store, ROOT, "b")).toBe(true);
    expect(isVisible(store, ROOT, "b1")).toBe(false);
  });

  it("is false for the global root, unknown nodes and nodes outside of the local root", () => {
    const store = setup();
    expect(isVisible(store, ROOT, ROOT)).toBe(false);
    expect(isVisible(store, ROOT, "x")).toBe(false);
    expect(isVisible(store, "a", "c")).toBe(false);
    expect(isVisible(store, "a", "a11")).toBe(true);
  });

  it("is true for the title and the children of a collapsed local root", () => {
    const store = setup();
    expect(isVisible(store, "b", "b")).toBe(true);
    expect(isVisible(store, "b", "b1")).toBe(true);
  });
});
