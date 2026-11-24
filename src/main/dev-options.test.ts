import { describe, expect, it } from "vitest";
import { resolveHidden, resolveSeedNodeCount } from "@/main/dev-options";

describe("resolveHidden", () => {
  it("is true only for DIAMIND_HIDDEN=1", () => {
    expect(resolveHidden({ DIAMIND_HIDDEN: "1" }, false)).toBe(true);
    expect(resolveHidden({ DIAMIND_HIDDEN: "0" }, false)).toBe(false);
    expect(resolveHidden({}, false)).toBe(false);
  });

  it("ignores DIAMIND_HIDDEN in a packaged app", () => {
    expect(resolveHidden({ DIAMIND_HIDDEN: "1" }, true)).toBe(false);
  });
});

describe("resolveSeedNodeCount", () => {
  it("is 0 without DIAMIND_SEED_NODES", () => {
    expect(resolveSeedNodeCount({}, false)).toBe(0);
  });

  it("reads DIAMIND_SEED_NODES", () => {
    expect(resolveSeedNodeCount({ DIAMIND_SEED_NODES: "5000" }, false)).toBe(
      5000,
    );
  });

  it("ignores DIAMIND_SEED_NODES in a packaged app", () => {
    expect(resolveSeedNodeCount({ DIAMIND_SEED_NODES: "5000" }, true)).toBe(0);
  });

  it("ignores an invalid value", () => {
    expect(resolveSeedNodeCount({ DIAMIND_SEED_NODES: "-5" }, false)).toBe(0);
    expect(resolveSeedNodeCount({ DIAMIND_SEED_NODES: "abc" }, false)).toBe(0);
  });

  it("caps the count", () => {
    expect(
      resolveSeedNodeCount({ DIAMIND_SEED_NODES: "99999999" }, false),
    ).toBe(1_000_000);
  });
});
