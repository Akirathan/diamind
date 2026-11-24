import type {
  ChangeSet,
  TableChanges,
} from "../../../shared/outline/change-set";
import type { Node, NodeUiState } from "../../../shared/outline/node";
import type { OutlineEvent, OutlineStore, RestoreRows } from "./store";

/** Consecutive edits of the same text or note merge until a pause this long. */
export const MERGE_PAUSE_MS = 1000;

/** The oldest steps above this limit are dropped. */
export const MAX_UNDO_STEPS = 1000;

export interface UndoOptions {
  /** Epoch milliseconds. */
  now?: () => number;
  mergePauseMs?: number;
  maxSteps?: number;
}

/** `undefined` means that the row does not exist. */
interface RowChange<Row> {
  before: Row | undefined;
  after: Row | undefined;
}

interface Step {
  nodes: Map<string, RowChange<Node>>;
  uiState: Map<string, RowChange<NodeUiState>>;
  /** Steps with the same key can merge, e.g. `text:<id>`; `null` never merges. */
  mergeKey: string | null;
  lastChangeAt: number;
}

/**
 * Records every change of the store as a step of row snapshots.
 * Undo and redo put back the exact rows, so ids, sort keys, timestamps
 * and UI state come back unchanged.
 */
export class UndoHistory {
  private readonly undoStack: Step[] = [];
  private readonly redoStack: Step[] = [];
  private readonly now: () => number;
  private readonly mergePauseMs: number;
  private readonly maxSteps: number;
  private readonly unsubscribe: () => void;
  private group: Step | null = null;
  private groupDepth = 0;
  private mergeOpen = false;
  private applying = false;

  constructor(
    private readonly store: OutlineStore,
    options: UndoOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.mergePauseMs = options.mergePauseMs ?? MERGE_PAUSE_MS;
    this.maxSteps = options.maxSteps ?? MAX_UNDO_STEPS;
    this.unsubscribe = store.subscribe((event) => this.record(event));
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Returns the changes, or `null` if there is nothing to undo. */
  undo(): ChangeSet | null {
    const step = this.popStep(this.undoStack);
    if (step === undefined) {
      return null;
    }
    const changes = this.apply(step, "before");
    this.redoStack.push(step);
    return changes;
  }

  /** Returns the changes, or `null` if there is nothing to redo. */
  redo(): ChangeSet | null {
    const step = this.popStep(this.redoStack);
    if (step === undefined) {
      return null;
    }
    const changes = this.apply(step, "after");
    this.undoStack.push(step);
    return changes;
  }

  /**
   * Records all commands of `run` as one step. Transactions can nest.
   * If `run` throws, the commands that succeeded before still form a step.
   */
  transaction<T>(run: () => T): T {
    if (this.groupDepth === 0) {
      this.group = newStep(null, this.now());
    }
    this.groupDepth++;
    try {
      return run();
    } finally {
      this.groupDepth--;
      if (this.groupDepth === 0) {
        const group = this.group as Step;
        this.group = null;
        this.pushStep(group);
      }
    }
  }

  /** The next text or note edit starts a new step, e.g. after a cursor move. */
  breakMerge(): void {
    this.mergeOpen = false;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.mergeOpen = false;
  }

  dispose(): void {
    this.unsubscribe();
  }

  private record(event: OutlineEvent): void {
    if (this.applying) {
      return;
    }
    this.redoStack.length = 0;
    const now = this.now();
    if (this.group !== null) {
      addChanges(this.group, event.changes);
      return;
    }
    const mergeKey = mergeKeyOf(event.changes);
    const top = this.undoStack[this.undoStack.length - 1];
    if (
      this.mergeOpen &&
      mergeKey !== null &&
      top !== undefined &&
      top.mergeKey === mergeKey &&
      now - top.lastChangeAt < this.mergePauseMs
    ) {
      addChanges(top, event.changes);
      top.lastChangeAt = now;
      return;
    }
    const step = newStep(mergeKey, now);
    addChanges(step, event.changes);
    this.pushStep(step);
  }

  private pushStep(step: Step): void {
    if (step.nodes.size === 0 && step.uiState.size === 0) {
      return;
    }
    this.undoStack.push(step);
    if (this.undoStack.length > this.maxSteps) {
      this.undoStack.shift();
    }
    this.mergeOpen = step.mergeKey !== null;
  }

  private popStep(stack: Step[]): Step | undefined {
    if (this.groupDepth > 0) {
      throw new Error("Undo and redo are not allowed inside a transaction");
    }
    this.mergeOpen = false;
    return stack.pop();
  }

  private apply(step: Step, side: "before" | "after"): ChangeSet {
    const nodes = collectRows(step.nodes, side);
    const uiState = collectRows(step.uiState, side);
    const rows: RestoreRows = { nodes, uiState };
    this.applying = true;
    try {
      return this.store.restoreRows(rows);
    } finally {
      this.applying = false;
    }
  }
}

function newStep(mergeKey: string | null, now: number): Step {
  return {
    nodes: new Map(),
    uiState: new Map(),
    mergeKey,
    lastChangeAt: now,
  };
}

function addChanges(step: Step, changes: ChangeSet): void {
  addTable(step.nodes, changes.nodes, (node) => node.id);
  addTable(step.uiState, changes.uiState, (state) => state.nodeId);
}

function addTable<Row>(
  target: Map<string, RowChange<Row>>,
  changes: TableChanges<Row>,
  idOf: (row: Row) => string,
): void {
  const before = new Map(changes.before.map((row) => [idOf(row), row]));

  function add(id: string, after: Row | undefined): void {
    const existing = target.get(id);
    const first = existing === undefined ? before.get(id) : existing.before;
    if (first === after) {
      target.delete(id);
    } else {
      target.set(id, { before: first, after });
    }
  }

  for (const row of changes.upsert) {
    add(idOf(row), row);
  }
  for (const id of changes.delete) {
    add(id, undefined);
  }
}

function collectRows<Row>(
  changes: Map<string, RowChange<Row>>,
  side: "before" | "after",
): { put: Row[]; remove: string[] } {
  const out: { put: Row[]; remove: string[] } = { put: [], remove: [] };
  for (const [id, change] of changes) {
    const row = change[side];
    if (row === undefined) {
      out.remove.push(id);
    } else {
      out.put.push(row);
    }
  }
  return out;
}

/** `text:<id>` or `note:<id>` if the changes edit only that field of one node. */
function mergeKeyOf(changes: ChangeSet): string | null {
  const { nodes, uiState } = changes;
  if (
    nodes.upsert.length !== 1 ||
    nodes.delete.length !== 0 ||
    nodes.before.length !== 1 ||
    uiState.upsert.length !== 0 ||
    uiState.delete.length !== 0
  ) {
    return null;
  }
  const next = nodes.upsert[0];
  const prev = nodes.before[0];
  if (prev.id !== next.id) {
    return null;
  }
  const { text, note, modifiedAt: _a, ...rest } = next;
  const { text: prevText, note: prevNote, modifiedAt: _b, ...prevRest } = prev;
  if (!sameFields(rest, prevRest)) {
    return null;
  }
  if (text !== prevText && note === prevNote) {
    return `text:${next.id}`;
  }
  if (note !== prevNote && text === prevText) {
    return `note:${next.id}`;
  }
  return null;
}

function sameFields(a: object, b: object): boolean {
  const aEntries = Object.entries(a);
  if (aEntries.length !== Object.keys(b).length) {
    return false;
  }
  return aEntries.every(
    ([key, value]) => (b as Record<string, unknown>)[key] === value,
  );
}
