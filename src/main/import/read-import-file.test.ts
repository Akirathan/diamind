import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readImportFile } from "@/main/import/read-import-file";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "diamind-import-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true });
  vi.restoreAllMocks();
});

function write(content: string | Uint8Array): string {
  const path = join(dir, "a.opml");
  writeFileSync(path, content);
  return path;
}

describe("readImportFile", () => {
  it("reads the text without the byte order mark", async () => {
    expect(await readImportFile(write("﻿čau 😀"))).toEqual({
      status: "opened",
      text: "čau 😀",
    });
  });

  it("rejects a file that is too large", async () => {
    const path = write("123456");
    expect(await readImportFile(path, 6)).toMatchObject({ status: "opened" });
    expect(await readImportFile(path, 5)).toEqual({
      status: "failed",
      message: "The file is larger than 5 bytes.",
    });
  });

  it("rejects invalid UTF-8", async () => {
    expect(await readImportFile(write(new Uint8Array([0xff, 0x41])))).toEqual({
      status: "failed",
      message: "The file is not encoded in UTF-8.",
    });
  });

  it("rejects a directory and a missing file", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await readImportFile(dir)).toMatchObject({ status: "failed" });
    expect(await readImportFile(join(dir, "missing"))).toEqual({
      status: "failed",
      message: "The file cannot be read.",
    });
  });
});
