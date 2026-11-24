import type { DiamindApi } from "@/shared/api";
import { cursorAt } from "@/renderer/src/outline/editing/cursor";
import type { NewNode } from "@/renderer/src/outline/commands/insert-tree";
import type { OutlineStore } from "@/renderer/src/outline/store/store";
import type { OutlineEditing } from "@/renderer/src/outline-view/editing/outline-editing";
import { ImportError } from "@/renderer/src/import/opml/import-error";
import { parseWorkflowy } from "@/renderer/src/import/opml/workflowy";

export type ImportApi = Pick<DiamindApi, "openImportFile" | "showImportError">;

export interface ImportTarget {
  store: OutlineStore;
  editing: OutlineEditing;
  /** The imported nodes become its last children. */
  rootId: string;
}

/** Lets the user choose a file and imports it. A file that cannot be imported changes nothing. */
export async function importWorkflowy(
  target: ImportTarget,
  api: ImportApi,
): Promise<void> {
  const file = await api.openImportFile();
  if (file.status === "canceled") {
    return;
  }
  if (file.status === "failed") {
    await api.showImportError(file.message);
    return;
  }
  let nodes: NewNode[];
  try {
    nodes = parseWorkflowy(file.text);
  } catch (error) {
    if (!(error instanceof ImportError)) {
      throw error;
    }
    await api.showImportError(error.message);
    return;
  }
  insert(target, nodes);
}

/** One undo step. The cursor goes to the first imported node. */
function insert(
  { store, editing, rootId }: ImportTarget,
  nodes: readonly NewNode[],
): void {
  const { history, focus } = editing;
  const cursor = history.transaction(() => {
    const { ids } = store.appendTree(rootId, nodes);
    const first = cursorAt(ids[0], 0);
    history.setCursorAfter(first);
    return first;
  });
  focus.request(cursor);
}
