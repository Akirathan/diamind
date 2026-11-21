import { describe, expect, it } from "vitest";
import { resolveDataDir } from "./paths";

describe("resolveDataDir", () => {
  it("defaults to ~/.local/share/diamind", () => {
    expect(resolveDataDir({}, "/home/user")).toBe(
      "/home/user/.local/share/diamind",
    );
  });

  it("uses DIAMIND_DATA_DIR when set", () => {
    expect(
      resolveDataDir({ DIAMIND_DATA_DIR: "/tmp/data" }, "/home/user"),
    ).toBe("/tmp/data");
  });

  it("ignores an empty DIAMIND_DATA_DIR", () => {
    expect(resolveDataDir({ DIAMIND_DATA_DIR: "" }, "/home/user")).toBe(
      "/home/user/.local/share/diamind",
    );
  });
});
