import { useCallback, useRef } from "react";
import { useMenuCommand } from "@/renderer/src/menu/menu-command";
import {
  importWorkflowy,
  type ImportTarget,
} from "@/renderer/src/import/import-workflowy";

/** Binds the import to the application menu. */
export function useImport({ store, editing, rootId }: ImportTarget): void {
  const running = useRef(false);

  const run = useCallback(() => {
    async function runOnce(): Promise<void> {
      if (running.current) {
        return;
      }
      running.current = true;
      try {
        await importWorkflowy({ store, editing, rootId }, window.diamind);
      } catch (error) {
        console.error("The import failed", error);
        await window.diamind.showImportError("An unexpected error occurred.");
      } finally {
        running.current = false;
      }
    }

    void runOnce();
  }, [store, editing, rootId]);

  useMenuCommand("importWorkflowy", run);
}
