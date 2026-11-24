import { describe, expect, it } from "vitest";
import type { OpenedImportFile } from "@/shared/import";
import { cursorAt } from "@/renderer/src/outline/editing/cursor";
import {
  createOutline,
  ROOT,
  snapshot,
} from "@/renderer/src/outline/fixtures/test-outline";
import { OutlineEditing } from "@/renderer/src/outline-view/editing/outline-editing";
import {
  importWorkflowy,
  type ImportApi,
} from "@/renderer/src/import/import-workflowy";

async function run(file: OpenedImportFile, rootId = ROOT) {
  const { store } = createOutline(`
    a
      b
    c
  `);
  const editing = new OutlineEditing(store, rootId);
  editing.focus.request(cursorAt("b", 1));
  const errors: string[] = [];
  const api: ImportApi = {
    openImportFile: () => Promise.resolve(file),
    showImportError: (message) => {
      errors.push(message);
      return Promise.resolve();
    },
  };
  const before = snapshot(store);
  await importWorkflowy({ store, editing, rootId }, api);
  return { store, editing, errors, before };
}

function opened(body: string): OpenedImportFile {
  return { status: "opened", text: `<opml><body>${body}</body></opml>` };
}

describe("importWorkflowy", () => {
  it("adds the nodes to the local root as one undo step", async () => {
    const file = opened(
      '<outline text="x"><outline text="y"/></outline><outline text="z"/>',
    );
    const { store, editing, errors, before } = await run(file, "a");
    const [b, x, z] = store.getChildren("a");
    expect(b).toBe("b");
    expect([x, z].map((id) => store.getNode(id)?.text)).toEqual(["x", "z"]);
    expect(store.getChildren(x)).toHaveLength(1);
    expect(editing.focus.cursor).toEqual(cursorAt(x, 0));
    expect(errors).toEqual([]);

    editing.history.undo();
    expect(snapshot(store)).toEqual(before);
    expect(editing.focus.cursor).toEqual(cursorAt("b", 1));
    expect(editing.history.canUndo).toBe(false);
    editing.history.redo();
    expect(store.getChildren("a")).toEqual([b, x, z]);
    expect(editing.focus.cursor).toEqual(cursorAt(x, 0));
  });

  it.each<[string, OpenedImportFile, string[]]>([
    ["canceled", { status: "canceled" }, []],
    ["unreadable", { status: "failed", message: "Oh" }, ["Oh"]],
    ["empty", opened(""), ["The file has no nodes."]],
    [
      "malformed",
      opened('<outline text="x"/><outline>'),
      [expect.stringContaining("malformed")],
    ],
  ])("changes nothing for a file that is %s", async (_case, file, messages) => {
    const { store, editing, errors, before } = await run(file);
    expect(errors).toEqual(messages);
    expect(snapshot(store)).toEqual(before);
    expect(editing.history.canUndo).toBe(false);
  });
});
