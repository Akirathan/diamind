import { describe, expect, it, vi } from "vitest";
import { openLink } from "@/main/open-link";

function fakeOpener(openPathResult = "") {
  return {
    openExternal: vi.fn(async (_url: string) => {}),
    openPath: vi.fn(async (_path: string) => openPathResult),
  };
}

describe("openLink", () => {
  it.each(["http://example.com/a", "https://example.com/a?b=c"])(
    "opens %s in the browser",
    async (url) => {
      const opener = fakeOpener();
      await openLink(url, opener);
      expect(opener.openExternal.mock.calls).toEqual([[url]]);
      expect(opener.openPath).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["file:///Users/pavel", "/Users/pavel"],
    ["file:///Users/my%20notes", "/Users/my notes"],
    ["file://localhost/Users", "/Users"],
  ])("opens %s as a path", async (url, path) => {
    const opener = fakeOpener();
    await openLink(url, opener);
    expect(opener.openPath.mock.calls).toEqual([[path]]);
    expect(opener.openExternal).not.toHaveBeenCalled();
  });

  it.each([
    "javascript:alert(1)",
    "vscode://file/x",
    "mailto:a@example.com",
    "file://server/share",
    "file:///a%2Fb",
    "/Users/pavel",
    "",
    undefined,
    null,
    42,
    { href: "https://example.com" },
    ["https://example.com"],
  ])("rejects %j", async (url) => {
    const opener = fakeOpener();
    await expect(openLink(url, opener)).rejects.toThrow();
    expect(opener.openExternal).not.toHaveBeenCalled();
    expect(opener.openPath).not.toHaveBeenCalled();
  });

  it("rejects when the path cannot be opened", async () => {
    const opener = fakeOpener("No such file");
    await expect(openLink("file:///missing", opener)).rejects.toThrow(
      "No such file",
    );
  });
});
