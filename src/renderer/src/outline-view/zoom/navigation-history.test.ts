import { describe, expect, it } from "vitest";
import type { NavigationHistory } from "@/shared/app-state";
import {
  MAX_ENTRIES,
  newHistory,
  replaceCurrent,
  restoreHistory,
  step,
  visit,
  type Direction,
} from "@/renderer/src/outline-view/zoom/navigation-history";

const all = (_id: string): boolean => true;

function historyOf(entries: string, index: number): NavigationHistory {
  return { entries: [...entries], index };
}

function currentAfter(
  history: NavigationHistory,
  direction: Direction,
  exists = all,
): string | null {
  const next = step(history, direction, exists);
  return next === null ? null : next.entries[next.index];
}

describe("visit", () => {
  it("adds an entry", () => {
    expect(visit(newHistory("a"), "b")).toEqual(historyOf("ab", 1));
  });

  it("drops the forward entries", () => {
    expect(visit(historyOf("abc", 0), "d")).toEqual(historyOf("ad", 1));
  });

  it("drops the oldest entries above the limit", () => {
    let history = newHistory("0");
    for (let i = 1; i <= MAX_ENTRIES; i++) {
      history = visit(history, String(i));
    }
    expect(history.entries).toHaveLength(MAX_ENTRIES);
    expect(history.entries[0]).toBe("1");
    expect(history.index).toBe(MAX_ENTRIES - 1);
  });
});

describe("step", () => {
  it("goes back and forward and keeps the entries", () => {
    const history = historyOf("abc", 1);
    expect(step(history, "back", all)).toEqual(historyOf("abc", 0));
    expect(step(history, "forward", all)).toEqual(historyOf("abc", 2));
  });

  it("stops at both ends", () => {
    expect(currentAfter(historyOf("ab", 0), "back")).toBeNull();
    expect(currentAfter(historyOf("ab", 1), "forward")).toBeNull();
  });

  it("skips deleted nodes", () => {
    const exists = (id: string): boolean => id !== "b";
    expect(currentAfter(historyOf("abc", 2), "back", exists)).toBe("a");
    expect(currentAfter(historyOf("abc", 0), "forward", exists)).toBe("c");
    expect(currentAfter(historyOf("bc", 1), "back", exists)).toBeNull();
  });

  it("skips entries of the current node", () => {
    const exists = (id: string): boolean => id !== "b";
    expect(currentAfter(historyOf("cbaba", 4), "back", exists)).toBe("c");
    expect(currentAfter(historyOf("aba", 2), "back", exists)).toBeNull();
  });
});

describe("replaceCurrent", () => {
  it("keeps the other entries", () => {
    expect(replaceCurrent(historyOf("abc", 1), "d")).toEqual(
      historyOf("adc", 1),
    );
  });
});

describe("restoreHistory", () => {
  it("keeps a valid history", () => {
    const history = historyOf("abc", 1);
    expect(restoreHistory(history, "b", all)).toEqual(history);
  });

  it("drops unknown nodes", () => {
    const exists = (id: string): boolean => !"xyz".includes(id);
    expect(restoreHistory(historyOf("xaybzc", 3), "b", exists)).toEqual(
      historyOf("abc", 1),
    );
  });

  it("replaces an unknown current node", () => {
    const exists = (id: string): boolean => id !== "x";
    expect(restoreHistory(historyOf("axc", 1), "r", exists)).toEqual(
      historyOf("arc", 1),
    );
  });

  it.each([
    undefined,
    null,
    "a",
    [],
    {},
    { entries: ["a"] },
    { entries: [], index: 0 },
    { entries: ["a", 1], index: 0 },
    { entries: ["a"], index: 1 },
    { entries: ["a"], index: 0.5 },
  ])("starts a new history for %j", (saved) => {
    expect(restoreHistory(saved, "r", all)).toEqual(newHistory("r"));
  });
});
