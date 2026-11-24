import { fileURLToPath } from "node:url";
import type { Node } from "@/shared/outline/node";
import { openDatabase, type Db } from "@/main/db/database";

export const MIGRATIONS_FOLDER = fileURLToPath(
  new URL("./migrations", import.meta.url),
);

export function openTestDatabase(): Db {
  return openDatabase(":memory:", MIGRATIONS_FOLDER);
}

export function testNode(id: string, fields: Partial<Node> = {}): Node {
  return {
    id,
    parentId: "root",
    sortKey: "a0",
    type: "text",
    format: "bullet",
    text: "",
    note: "",
    completedAt: null,
    attachmentId: null,
    createdAt: 1000,
    modifiedAt: 2000,
    ...fields,
  };
}
