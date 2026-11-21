import { describe, expect, it } from "vitest";
import { resolveSeedNodeCount } from "./dev-options";

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
