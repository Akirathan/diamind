import type { AppStateValues } from "@/shared/app-state";
import {
  isEmptyChangeSet,
  type ChangeBatch,
  type ChangeSet,
} from "@/shared/outline/change-set";
import type { Node, NodeUiState } from "@/shared/outline/node";

export const FLUSH_DELAY_MS = 300;
/** Limits the wait while changes come without a pause. */
export const MAX_WAIT_MS = 2000;
export const RETRY_DELAY_MS = 1000;
export const MAX_RETRY_DELAY_MS = 30_000;

export interface Timer {
  /** Returns a function that cancels the call. */
  schedule(run: () => void, delayMs: number): () => void;
}

export interface WriteQueueOptions {
  timer?: Timer;
  onError?: (error: unknown) => void;
}

/** `null` means that the row is deleted. */
interface QueuedRows {
  nodes: Map<string, Node | null>;
  uiState: Map<string, NodeUiState | null>;
  appState: AppStateValues;
}

const systemTimer: Timer = {
  schedule(run, delayMs) {
    const handle = setTimeout(run, delayMs);
    return () => clearTimeout(handle);
  },
};

/**
 * Collects changed rows and saves them in batches, the last change of each row only.
 * Only one save runs at a time. The rows of a failed save are queued again and retried.
 */
export class WriteQueue {
  private readonly timer: Timer;
  private readonly onError: (error: unknown) => void;
  private pending = newRows();
  private saving: QueuedRows | null = null;
  private saveAgain = false;
  private cancelTimer: (() => void) | null = null;
  private cancelMaxWait: (() => void) | null = null;
  private retryDelayMs = RETRY_DELAY_MS;
  private idleListeners: (() => void)[] = [];

  constructor(
    private readonly save: (batch: ChangeBatch) => Promise<void>,
    options: WriteQueueOptions = {},
  ) {
    this.timer = options.timer ?? systemTimer;
    this.onError =
      options.onError ??
      ((error) => console.error("Saving the changes failed", error));
  }

  add(changes: ChangeSet): void {
    if (isEmptyChangeSet(changes)) {
      return;
    }
    for (const node of changes.nodes.upsert) {
      this.pending.nodes.set(node.id, node);
    }
    for (const id of changes.nodes.delete) {
      this.pending.nodes.set(id, null);
    }
    for (const state of changes.uiState.upsert) {
      this.pending.uiState.set(state.nodeId, state);
    }
    for (const id of changes.uiState.delete) {
      this.pending.uiState.set(id, null);
    }
    this.scheduleSave();
  }

  addAppState(values: AppStateValues): void {
    this.pending.appState = { ...this.pending.appState, ...values };
    this.scheduleSave();
  }

  /** Saves now. Resolves when no change is unsaved, also after failed saves. */
  flush(): Promise<void> {
    if (this.saving === null && isEmpty(this.pending)) {
      return Promise.resolve();
    }
    const idle = new Promise<void>((resolve) => {
      this.idleListeners.push(resolve);
    });
    this.startSave();
    return idle;
  }

  private scheduleSave(): void {
    this.startTimer(FLUSH_DELAY_MS);
    this.cancelMaxWait ??= this.timer.schedule(
      () => this.startSave(),
      MAX_WAIT_MS,
    );
  }

  private startTimer(delayMs: number): void {
    this.stopTimer();
    this.cancelTimer = this.timer.schedule(() => this.startSave(), delayMs);
  }

  private stopTimer(): void {
    this.cancelTimer?.();
    this.cancelTimer = null;
  }

  private startSave(): void {
    this.stopTimer();
    this.cancelMaxWait?.();
    this.cancelMaxWait = null;
    if (this.saving !== null) {
      this.saveAgain = !isEmpty(this.pending);
      return;
    }
    void this.runSave();
  }

  private async runSave(): Promise<void> {
    const rows = this.pending;
    this.pending = newRows();
    this.saving = rows;
    this.saveAgain = false;
    try {
      await this.save(toBatch(rows));
    } catch (error) {
      this.saving = null;
      this.requeue(rows);
      this.startTimer(this.retryDelayMs);
      this.retryDelayMs = Math.min(this.retryDelayMs * 2, MAX_RETRY_DELAY_MS);
      this.onError(error);
      return;
    }
    this.saving = null;
    this.retryDelayMs = RETRY_DELAY_MS;
    if (isEmpty(this.pending)) {
      this.notifyIdle();
    } else if (this.saveAgain) {
      this.startSave();
    }
  }

  /** Changes made during the failed save are newer, so they win. */
  private requeue(failed: QueuedRows): void {
    this.pending = {
      nodes: new Map([...failed.nodes, ...this.pending.nodes]),
      uiState: new Map([...failed.uiState, ...this.pending.uiState]),
      appState: { ...failed.appState, ...this.pending.appState },
    };
  }

  private notifyIdle(): void {
    const listeners = this.idleListeners;
    this.idleListeners = [];
    for (const listener of listeners) {
      listener();
    }
  }
}

function newRows(): QueuedRows {
  return { nodes: new Map(), uiState: new Map(), appState: {} };
}

function isEmpty(rows: QueuedRows): boolean {
  return (
    rows.nodes.size === 0 &&
    rows.uiState.size === 0 &&
    Object.keys(rows.appState).length === 0
  );
}

function toBatch(rows: QueuedRows): ChangeBatch {
  const batch = { nodes: toTable(rows.nodes), uiState: toTable(rows.uiState) };
  return Object.keys(rows.appState).length === 0
    ? batch
    : { ...batch, appState: rows.appState };
}

function toTable<Row>(rows: Map<string, Row | null>): {
  upsert: Row[];
  delete: string[];
} {
  const table: { upsert: Row[]; delete: string[] } = { upsert: [], delete: [] };
  for (const [id, row] of rows) {
    if (row === null) {
      table.delete.push(id);
    } else {
      table.upsert.push(row);
    }
  }
  return table;
}
