import { describe, expect, it } from "vitest";
import { parseLinkUrl } from "@/shared/link-url";

describe("parseLinkUrl", () => {
  it.each([
    ["http://example.com", "http://example.com/"],
    ["https://example.com/a?b=c#d", "https://example.com/a?b=c#d"],
    ["HTTPS://Example.com", "https://example.com/"],
    ["file:///Users/pavel", "file:///Users/pavel"],
    ["file:///Users/my notes", "file:///Users/my%20notes"],
  ])("accepts %s", (text, href) => {
    expect(parseLinkUrl(text)?.href).toBe(href);
  });

  it.each([
    "",
    "example.com",
    "www.example.com",
    "//example.com",
    "/Users/pavel",
    "javascript:alert(1)",
    "JavaScript://example.com/%0aalert(1)",
    "data:text/html,x",
    "blob:https://example.com/x",
    "mailto:a@example.com",
    "ftp://example.com",
    "vscode://file/x",
    "x-apple.systempreferences://x",
    "http:example.com",
    "file:/Users/pavel",
    "http://",
    "https://exa mple.com",
    " https://example.com",
    "java\nscript:alert(1)",
    "view-source:https://example.com",
  ])("rejects %j", (text) => {
    expect(parseLinkUrl(text)).toBeNull();
  });
});
