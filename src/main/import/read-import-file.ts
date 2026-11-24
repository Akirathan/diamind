import { open } from "node:fs/promises";
import type { OpenedImportFile } from "@/shared/import";

export const MAX_IMPORT_BYTES = 100 * 1024 * 1024;

export async function readImportFile(
  path: string,
  maxBytes: number = MAX_IMPORT_BYTES,
): Promise<OpenedImportFile> {
  let bytes: Buffer;
  try {
    const file = await open(path);
    try {
      const stats = await file.stat();
      if (!stats.isFile()) {
        return failed("It is not a file.");
      }
      if (stats.size > maxBytes) {
        return failed(`The file is larger than ${maxBytes} bytes.`);
      }
      bytes = await file.readFile();
    } finally {
      await file.close();
    }
  } catch (error) {
    console.error("Reading the file to import failed", error);
    return failed("The file cannot be read.");
  }
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    return { status: "opened", text: decoder.decode(bytes) };
  } catch {
    return failed("The file is not encoded in UTF-8.");
  }
}

function failed(message: string): OpenedImportFile {
  return { status: "failed", message };
}
