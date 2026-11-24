import type { ChangeSet, TableChanges } from "@/shared/outline/change-set";
import type { Node, NodeUiState } from "@/shared/outline/node";
import type { NodeCursor } from "@/renderer/src/outline/editing/cursor";
import type {
  OutlineEvent,
  OutlineStore,
  RestoreRows,
} from "@/renderer/src/outline/store/store";

/** Consecutive edits of the same text or note merge until a pause this long. */
export const MERGE_PAUSE_MS = 1000;

/** The oldest steps above this limit are dropped. */
export const MAX_UNDO_STEPS = 1000;

/** Connects the history to the text cursor of the editors. */
export interface UndoCursor {
  /** The cursor before the change that the history is about to record. */
  get(): NodeCursor | null;
  /** Called after each undo and redo. `cursor` may point to a node that does not exist. */
  restore(cursor: NodeCursor | null, changes: ChangeSet): void;
}

export interface UndoOptions {
  /** Epoch milliseconds. */
  now?: () => number;
  mergePauseMs?: number;
  maxSteps?: number;
  cursor?: UndoCursor;
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
  cursorBefore: NodeCursor | null;
  cursorAfter: NodeCursor | null;
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
  private readonly cursor: UndoCursor | null;
  private readonly unsubscribe: () => void;
  private group: Step | null = null;
  private mergeOpen = false;
  private recording = true;

  constructor(
    private readonly store: OutlineStore,
    options: UndoOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.mergePauseMs = options.mergePauseMs ?? MERGE_PAUSE_MS;
    this.maxSteps = options.maxSteps ?? MAX_UNDO_STEPS;
    this.cursor = options.cursor ?? null;
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
    this.cursor?.restore(step.cursorBefore, changes);
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
    this.cursor?.restore(step.cursorAfter ?? step.cursorBefore, changes);
    return changes;
  }

  /**
   * Records all commands of `run` as one step. If `run` throws, its commands
   * are undone and the history is as before.
   * A nested transaction joins the outermost one, which alone decides: an
   * error that is caught inside the outermost `run` undoes nothing.
   */
  transaction<T>(run: () => T): T {
    if (this.group !== null) {
      return run();
    }
    const group = this.newStep(null);
    this.group = group;
    let result: T;
    try {
      result = run();
    } catch (error) {
      this.apply(group, "before");
      throw error;
    } finally {
      this.group = null;
    }
    this.pushStep(group);
    return result;
  }

  /** Runs commands that the user cannot undo. */
  untracked<T>(run: () => T): T {
    const { recording } = this;
    this.recording = false;
    try {
      return run();
    } finally {
      this.recording = recording;
    }
  }

  /** Sets where redo of the current transaction, or of the last step, puts the cursor. */
  setCursorAfter(cursor: NodeCursor): void {
    const step = this.group ?? this.undoStack[this.undoStack.length - 1];
    if (step !== undefined) {
      step.cursorAfter = cursor;
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
    if (!this.recording) {
      return;
    }
    if (this.group !== null) {
      addChanges(this.group, event.changes);
      return;
    }
    const now = this.now();
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
      this.redoStack.length = 0;
      top.lastChangeAt = now;
      return;
    }
    const step = this.newStep(mergeKey);
    addChanges(step, event.changes);
    this.pushStep(step);
  }

  private pushStep(step: Step): void {
    if (step.nodes.size === 0 && step.uiState.size === 0) {
      return;
    }
    this.redoStack.length = 0;
    this.undoStack.push(step);
    if (this.undoStack.length > this.maxSteps) {
      this.undoStack.shift();
    }
    this.mergeOpen = step.mergeKey !== null;
  }

  private popStep(stack: Step[]): Step | undefined {
    if (this.group !== null) {
      throw new Error("Undo and redo are not allowed inside a transaction");
    }
    this.mergeOpen = false;
    return stack.pop();
  }

  private apply(step: Step, side: "before" | "after"): ChangeSet {
    const nodes = collectRows(step.nodes, side);
    const uiState = collectRows(step.uiState, side);
    const rows: RestoreRows = { nodes, uiState };
    return this.untracked(() => this.store.restoreRows(rows));
  }

  private newStep(mergeKey: string | null): Step {
    return {
      nodes: new Map(),
      uiState: new Map(),
      mergeKey,
      lastChangeAt: this.now(),
      cursorBefore: this.cursor?.get() ?? null,
      cursorAfter: null,
    };
  }
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
