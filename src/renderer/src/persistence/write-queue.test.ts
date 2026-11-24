import { beforeEach, describe, expect, it } from "vitest";
import {
  emptyChangeSet,
  type ChangeBatch,
  type ChangeSet,
} from "@/shared/outline/change-set";
import { testNode } from "@/renderer/src/outline/fixtures/test-outline";
import { FakeTimer, settle } from "@/renderer/src/persistence/fake-timer";
import {
  FLUSH_DELAY_MS,
  MAX_RETRY_DELAY_MS,
  MAX_WAIT_MS,
  RETRY_DELAY_MS,
  WriteQueue,
} from "@/renderer/src/persistence/write-queue";

interface Save {
  batch: ChangeBatch;
  resolve: () => void;
  reject: (error: Error) => void;
}

let timer: FakeTimer;
let saves: Save[];
let errors: unknown[];
let queue: WriteQueue;

beforeEach(() => {
  timer = new FakeTimer();
  saves = [];
  errors = [];
  queue = new WriteQueue(
    (batch) =>
      new Promise((resolve, reject) => {
        saves.push({ batch, resolve, reject });
      }),
    { timer, onError: (error) => errors.push(error) },
  );
});

function upsert(id: string, text = id): ChangeSet {
  const changes = emptyChangeSet();
  changes.nodes.upsert.push(testNode(id, "root", "a0", text));
  return changes;
}

function remove(id: string): ChangeSet {
  const changes = emptyChangeSet();
  changes.nodes.delete.push(id);
  changes.nodes.before.push(testNode(id, "root", "a0"));
  return changes;
}

function collapse(id: string, collapsed: boolean): ChangeSet {
  const changes = emptyChangeSet();
  changes.uiState.upsert.push({ nodeId: id, collapsed, scrollTop: null });
  return changes;
}

function removeUiState(id: string): ChangeSet {
  const changes = emptyChangeSet();
  changes.uiState.delete.push(id);
  return changes;
}

async function finish(save: Save, error?: Error): Promise<void> {
  if (error === undefined) {
    save.resolve();
  } else {
    save.reject(error);
  }
  await settle();
}

/** `+id=text` for an upserted node, `-id` for a deleted one. */
function nodeChanges(save: Save): string[] {
  const { upsert, delete: deleted } = save.batch.nodes;
  return [
    ...upsert.map((node) => `+${node.id}=${node.text}`),
    ...deleted.map((id) => `-${id}`),
  ];
}

describe("merging", () => {
  it("saves the last version of a row only", () => {
    queue.add(upsert("a", "1"));
    queue.add(upsert("b"));
    queue.add(upsert("a", "2"));
    void queue.flush();
    expect(saves).toHaveLength(1);
    expect(nodeChanges(saves[0])).toEqual(["+a=2", "+b=b"]);
  });

  it("replaces an upsert with a later delete", () => {
    queue.add(upsert("a"));
    queue.add(remove("a"));
    void queue.flush();
    expect(nodeChanges(saves[0])).toEqual(["-a"]);
  });

  it("replaces a delete with a later upsert", () => {
    queue.add(remove("a"));
    queue.add(upsert("a", "restored"));
    void queue.flush();
    expect(nodeChanges(saves[0])).toEqual(["+a=restored"]);
  });

  it("merges the UI state separately from the node with the same id", () => {
    queue.add(upsert("a"));
    queue.add(collapse("a", true));
    queue.add(collapse("a", false));
    queue.add(collapse("b", true));
    queue.add(removeUiState("b"));
    queue.add(removeUiState("c"));
    queue.add(collapse("c", true));
    void queue.flush();
    expect(nodeChanges(saves[0])).toEqual(["+a=a"]);
    expect(saves[0].batch.uiState).toEqual({
      upsert: [
        { nodeId: "a", collapsed: false, scrollTop: null },
        { nodeId: "c", collapsed: true, scrollTop: null },
      ],
      delete: ["b"],
    });
  });

  it("does not send the previous versions", () => {
    queue.add(remove("a"));
    void queue.flush();
    expect(saves[0].batch).toEqual({
      nodes: { upsert: [], delete: ["a"] },
      uiState: { upsert: [], delete: [] },
    });
  });
});

describe("delay", () => {
  it("saves after a pause", async () => {
    queue.add(upsert("a"));
    await timer.advance(FLUSH_DELAY_MS - 1);
    expect(saves).toHaveLength(0);
    await timer.advance(1);
    expect(saves).toHaveLength(1);
  });

  it("starts the delay again with each change", async () => {
    queue.add(upsert("a", "1"));
    await timer.advance(FLUSH_DELAY_MS - 1);
    queue.add(upsert("a", "2"));
    await timer.advance(FLUSH_DELAY_MS - 1);
    expect(saves).toHaveLength(0);
    await timer.advance(1);
    expect(nodeChanges(saves[0])).toEqual(["+a=2"]);
  });

  it("saves after the maximum wait if there is no pause", async () => {
    const stepMs = FLUSH_DELAY_MS / 3;
    for (let ms = 0; ms < MAX_WAIT_MS; ms += stepMs) {
      expect(saves).toHaveLength(0);
      queue.add(upsert("a", String(ms)));
      await timer.advance(stepMs);
    }
    expect(saves).toHaveLength(1);
    expect(nodeChanges(saves[0])).toEqual([`+a=${MAX_WAIT_MS - stepMs}`]);
    expect(timer.scheduledCount).toBe(0);
  });

  it("starts the maximum wait again after a save", async () => {
    queue.add(upsert("a"));
    await timer.advance(FLUSH_DELAY_MS);
    await finish(saves[0]);
    await timer.advance(MAX_WAIT_MS);
    queue.add(upsert("a"));
    await timer.advance(FLUSH_DELAY_MS - 1);
    expect(saves).toHaveLength(1);
  });

  it("saves changes made without a pause during a save right after it", async () => {
    queue.add(upsert("a"));
    void queue.flush();
    for (let ms = 0; ms < MAX_WAIT_MS; ms += 100) {
      queue.add(upsert("a", String(ms)));
      await timer.advance(100);
    }
    expect(saves).toHaveLength(1);
    await finish(saves[0]);
    expect(saves).toHaveLength(2);
  });

  it("ignores an empty change set", () => {
    queue.add(emptyChangeSet());
    expect(timer.scheduledCount).toBe(0);
  });
});

describe("ordering", () => {
  it("never runs two saves at the same time", async () => {
    queue.add(upsert("a", "1"));
    await timer.advance(FLUSH_DELAY_MS);
    queue.add(upsert("a", "2"));
    await timer.advance(FLUSH_DELAY_MS);
    void queue.flush();
    expect(saves).toHaveLength(1);

    await finish(saves[0]);
    expect(saves).toHaveLength(2);
    expect(nodeChanges(saves[1])).toEqual(["+a=2"]);
    expect(timer.scheduledCount).toBe(0);
  });

  it("keeps the delay of a change made during a save", async () => {
    queue.add(upsert("a"));
    await timer.advance(FLUSH_DELAY_MS);
    queue.add(upsert("b"));
    await finish(saves[0]);
    expect(saves).toHaveLength(1);
    await timer.advance(FLUSH_DELAY_MS);
    expect(nodeChanges(saves[1])).toEqual(["+b=b"]);
  });
});

describe("flush", () => {
  it("saves at once and cancels the delay", () => {
    queue.add(upsert("a"));
    void queue.flush();
    expect(saves).toHaveLength(1);
    expect(timer.scheduledCount).toBe(0);
  });

  it("resolves at once if nothing is unsaved", async () => {
    await queue.flush();
    expect(saves).toHaveLength(0);
  });

  it("resolves after the running save and the rest are saved", async () => {
    let done = false;
    queue.add(upsert("a"));
    await timer.advance(FLUSH_DELAY_MS);
    queue.add(upsert("b"));
    void queue.flush().then(() => {
      done = true;
    });
    await finish(saves[0]);
    expect(done).toBe(false);
    await finish(saves[1]);
    expect(done).toBe(true);
  });

  it("waits for a running save that holds all changes", async () => {
    let done = false;
    queue.add(upsert("a"));
    await timer.advance(FLUSH_DELAY_MS);
    void queue.flush().then(() => {
      done = true;
    });
    await settle();
    expect(done).toBe(false);
    await finish(saves[0]);
    expect(done).toBe(true);
    expect(saves).toHaveLength(1);
  });

  it("resolves only after a failed save was retried", async () => {
    let done = false;
    queue.add(upsert("a"));
    void queue.flush().then(() => {
      done = true;
    });
    await finish(saves[0], new Error("disk full"));
    expect(done).toBe(false);
    await timer.advance(RETRY_DELAY_MS);
    await finish(saves[1]);
    expect(done).toBe(true);
  });
});

describe("failed save", () => {
  it("reports the error and retries with the same rows", async () => {
    const error = new Error("disk full");
    queue.add(upsert("a"));
    queue.add(remove("b"));
    queue.add(collapse("a", true));
    await timer.advance(FLUSH_DELAY_MS);
    await finish(saves[0], error);
    expect(errors).toEqual([error]);

    await timer.advance(RETRY_DELAY_MS);
    expect(saves).toHaveLength(2);
    expect(saves[1].batch).toEqual(saves[0].batch);
  });

  it("keeps newer changes made during the failed save", async () => {
    queue.add(upsert("a", "old"));
    queue.add(upsert("b", "old"));
    queue.add(remove("c"));
    await timer.advance(FLUSH_DELAY_MS);
    queue.add(remove("a"));
    queue.add(upsert("c", "new"));
    await finish(saves[0], new Error("disk full"));

    await timer.advance(RETRY_DELAY_MS);
    expect(nodeChanges(saves[1]).sort()).toEqual(["+b=old", "+c=new", "-a"]);
  });

  it("retries together with the next change", async () => {
    queue.add(upsert("a"));
    await timer.advance(FLUSH_DELAY_MS);
    await finish(saves[0], new Error("disk full"));
    queue.add(upsert("b"));
    await timer.advance(FLUSH_DELAY_MS);
    expect(nodeChanges(saves[1])).toEqual(["+a=a", "+b=b"]);
    expect(timer.scheduledCount).toBe(0);
  });

  it("waits longer after each failure, up to a limit", async () => {
    queue.add(upsert("a"));
    await timer.advance(FLUSH_DELAY_MS);
    let delay = RETRY_DELAY_MS;
    for (let i = 0; i < 8; i++) {
      await finish(saves[i], new Error("disk full"));
      await timer.advance(delay - 1);
      expect(saves).toHaveLength(i + 1);
      await timer.advance(1);
      expect(saves).toHaveLength(i + 2);
      delay = Math.min(delay * 2, MAX_RETRY_DELAY_MS);
    }
    await finish(saves[8]);
    queue.add(upsert("a"));
    await timer.advance(FLUSH_DELAY_MS);
    await finish(saves[9], new Error("disk full"));
    await timer.advance(RETRY_DELAY_MS);
    expect(saves).toHaveLength(11);
  });

  it("handles a save function that throws", async () => {
    const failing = new WriteQueue(
      () => {
        throw new Error("no IPC");
      },
      { timer, onError: (error) => errors.push(error) },
    );
    failing.add(upsert("a"));
    await timer.advance(FLUSH_DELAY_MS);
    expect(errors).toHaveLength(1);
    expect(timer.scheduledCount).toBe(1);
  });
});
