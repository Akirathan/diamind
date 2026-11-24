import { beforeEach, describe, expect, it } from "vitest";
import { emptyChangeSet, type ChangeBatch } from "@/shared/outline/change-set";
import type { Node, NodeUiState } from "@/shared/outline/node";
import { OutlineStore } from "@/renderer/src/outline/store";
import { createOutline, snapshot } from "@/renderer/src/outline/test-outline";
import { UndoHistory } from "@/renderer/src/outline/undo";
import { FakeTimer } from "@/renderer/src/persistence/fake-timer";
import {
  saveOutline,
  type SaveApi,
} from "@/renderer/src/persistence/save-outline";
import { FLUSH_DELAY_MS } from "@/renderer/src/persistence/write-queue";

/** Keeps the saved rows like the database. */
class FakeDatabase implements SaveApi {
  readonly nodes = new Map<string, Node>();
  readonly uiState = new Map<string, NodeUiState>();
  saveCount = 0;
  requestFlush: (() => Promise<void>) | null = null;

  async saveChanges(json: string): Promise<void> {
    this.saveCount++;
    const batch = JSON.parse(json) as ChangeBatch;
    batch.nodes.delete.forEach((id) => this.nodes.delete(id));
    batch.uiState.delete.forEach((id) => this.uiState.delete(id));
    batch.nodes.upsert.forEach((node) => this.nodes.set(node.id, node));
    batch.uiState.upsert.forEach((state) =>
      this.uiState.set(state.nodeId, state),
    );
  }

  onFlushRequest(flush: () => Promise<void>): () => void {
    this.requestFlush = flush;
    return () => {
      this.requestFlush = null;
    };
  }

  load(): OutlineStore {
    return OutlineStore.load({
      nodes: [...this.nodes.values()],
      uiState: [...this.uiState.values()],
    }).store;
  }
}

let db: FakeDatabase;
let timer: FakeTimer;
let windowEvents: EventTarget;

beforeEach(() => {
  db = new FakeDatabase();
  timer = new FakeTimer();
  windowEvents = new EventTarget();
});

function startEmpty(): { store: OutlineStore; stop: () => void } {
  const { store, changes } = OutlineStore.load({ nodes: [] });
  const stop = saveOutline(store, changes, db, windowEvents, { timer });
  return { store, stop };
}

describe("saveOutline", () => {
  it("saves the new global root of an empty database", async () => {
    const { store } = startEmpty();
    await timer.advance(FLUSH_DELAY_MS);
    expect(db.load().rootId).toBe(store.rootId);
  });

  it("saves commands, undo and redo", async () => {
    const { store } = startEmpty();
    const undo = new UndoHistory(store);
    const a = store.insertNode(store.rootId, null).id;
    store.setText(a, "a");
    const b = store.insertNode(a, null).id;
    store.setText(b, "b");
    store.setAttribute(b, "key", [1]);
    store.setCollapsed(a, true);
    await timer.advance(FLUSH_DELAY_MS);
    expect(snapshot(db.load())).toEqual(snapshot(store));

    store.deleteNode(a);
    await timer.advance(FLUSH_DELAY_MS);
    expect(db.nodes.size).toBe(1);
    expect(db.uiState.size).toBe(0);

    undo.undo();
    await timer.advance(FLUSH_DELAY_MS);
    expect(db.nodes.size).toBe(3);
    expect(snapshot(db.load())).toEqual(snapshot(store));

    undo.redo();
    await timer.advance(FLUSH_DELAY_MS);
    expect(db.nodes.size).toBe(1);
  });

  it("saves nothing if a loaded outline does not change", async () => {
    const { store } = createOutline(`
      a
        b
    `);
    saveOutline(store, emptyChangeSet(), db, windowEvents, { timer });
    windowEvents.dispatchEvent(new Event("blur"));
    await timer.advance(FLUSH_DELAY_MS);
    expect(db.saveCount).toBe(0);
  });

  it.each(["blur", "pagehide"])("saves at once on %s", async (type) => {
    const { store } = startEmpty();
    windowEvents.dispatchEvent(new Event(type));
    expect(db.load().rootId).toBe(store.rootId);
    await timer.advance(FLUSH_DELAY_MS);
    expect(db.saveCount).toBe(1);
  });

  it("answers a flush request after the save", async () => {
    const { store } = startEmpty();
    await db.requestFlush?.();
    expect(db.load().rootId).toBe(store.rootId);
  });

  it("saves the rest and stops", async () => {
    const { store, stop } = startEmpty();
    stop();
    expect(db.saveCount).toBe(1);
    expect(db.requestFlush).toBeNull();
    store.insertNode(store.rootId, null);
    windowEvents.dispatchEvent(new Event("blur"));
    await timer.advance(FLUSH_DELAY_MS);
    expect(db.nodes.size).toBe(1);
  });
});
