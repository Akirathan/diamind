import type { DiamindApi } from "@/shared/api";
import type { ChangeSet } from "@/shared/outline/change-set";
import type { OutlineStore } from "@/renderer/src/outline/store/store";
import {
  WriteQueue,
  type WriteQueueOptions,
} from "@/renderer/src/persistence/write-queue";

export type SaveApi = Pick<DiamindApi, "saveChanges" | "onFlushRequest">;

/**
 * Saves `unsaved` and every later change of the store.
 * Returns a function that saves the rest and stops.
 */
export function saveOutline(
  store: OutlineStore,
  unsaved: ChangeSet,
  api: SaveApi,
  windowEvents: EventTarget = window,
  options?: WriteQueueOptions,
): () => void {
  const queue = new WriteQueue(
    async (batch) => api.saveChanges(JSON.stringify(batch)),
    options,
  );
  queue.add(unsaved);

  function flush(): void {
    void queue.flush();
  }

  const unsubscribe = store.subscribe((event) => queue.add(event.changes));
  const removeFlushRequest = api.onFlushRequest(() => queue.flush());
  windowEvents.addEventListener("blur", flush);
  // A reload of the page does not request a flush.
  windowEvents.addEventListener("pagehide", flush);

  return () => {
    unsubscribe();
    removeFlushRequest();
    windowEvents.removeEventListener("blur", flush);
    windowEvents.removeEventListener("pagehide", flush);
    flush();
  };
}
