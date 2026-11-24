import {
  isEmptyChangeSet,
  type ChangeSet,
} from "../../../shared/outline/change-set";
import type {
  JsonValue,
  Node,
  NodeFormat,
  NodeUiState,
} from "../../../shared/outline/node";
import * as fields from "./field-commands";
import { restoreRows, type RestoreRows } from "./restore";
import { loadModel, type OutlineRows } from "./load";
import type { OutlineModel, OutlineOptions } from "./model";
import * as structure from "./structure-commands";

export type { RestoreRows } from "./restore";

export interface OutlineEvent {
  /** Changed and deleted nodes, plus the parents whose children changed. */
  changedIds: ReadonlySet<string>;
  changes: ChangeSet;
}

export type OutlineListener = (event: OutlineEvent) => void;

/**
 * The in-memory outline. Every change goes through a command, which either
 * throws an `OutlineError` and changes nothing, or returns the changed rows.
 */
export class OutlineStore {
  private readonly listeners = new Set<OutlineListener>();

  private constructor(private readonly model: OutlineModel) {}

  /** `changes` holds the global root if the store created it. */
  static load(
    rows: OutlineRows,
    options?: OutlineOptions,
  ): { store: OutlineStore; changes: ChangeSet } {
    const { model, changes } = loadModel(rows, options);
    return { store: new OutlineStore(model), changes };
  }

  get rootId(): string {
    return this.model.rootId;
  }

  get size(): number {
    return this.model.nodes.size;
  }

  getNode(id: string): Node | undefined {
    return this.model.nodes.get(id);
  }

  /** Sorted by `sortKey`. Do not mutate the returned array. */
  getChildren(id: string): readonly string[] {
    return this.model.childIds(id);
  }

  getUiState(id: string): NodeUiState | undefined {
    return this.model.uiState.get(id);
  }

  subscribe(listener: OutlineListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  insertNode(
    parentId: string,
    afterId: string | null,
    format?: NodeFormat,
    content?: structure.NewNodeContent,
  ): structure.InsertResult {
    const result = structure.insertNode(
      this.model,
      parentId,
      afterId,
      format,
      content,
    );
    this.notify(result.changes);
    return result;
  }

  setText(id: string, text: string): ChangeSet {
    return this.run(() => fields.setText(this.model, id, text));
  }

  setNote(id: string, note: string): ChangeSet {
    return this.run(() => fields.setNote(this.model, id, note));
  }

  setFormat(id: string, format: NodeFormat): ChangeSet {
    return this.run(() => fields.setFormat(this.model, id, format));
  }

  setCompleted(ids: readonly string[], completed: boolean): ChangeSet {
    return this.run(() => fields.setCompleted(this.model, ids, completed));
  }

  indent(id: string): ChangeSet {
    return this.run(() => structure.indent(this.model, id));
  }

  unindent(id: string): ChangeSet {
    return this.run(() => structure.unindent(this.model, id));
  }

  move(id: string, newParentId: string, afterId: string | null): ChangeSet {
    return this.run(() => structure.move(this.model, id, newParentId, afterId));
  }

  deleteNode(id: string): ChangeSet {
    return this.run(() => structure.deleteNode(this.model, id));
  }

  setCollapsed(id: string, collapsed: boolean): ChangeSet {
    return this.run(() => fields.setCollapsed(this.model, id, collapsed));
  }

  setAttribute(id: string, key: string, value: JsonValue): ChangeSet {
    return this.run(() => fields.setAttribute(this.model, id, key, value));
  }

  removeAttribute(id: string, key: string): ChangeSet {
    return this.run(() => fields.removeAttribute(this.model, id, key));
  }

  /**
   * Puts and removes raw rows without validation, for undo and redo.
   * The rows must form a valid outline afterwards.
   */
  restoreRows(rows: RestoreRows): ChangeSet {
    return this.run(() => restoreRows(this.model, rows));
  }

  private run(command: () => ChangeSet): ChangeSet {
    const changes = command();
    this.notify(changes);
    return changes;
  }

  private notify(changes: ChangeSet): void {
    if (isEmptyChangeSet(changes) || this.listeners.size === 0) {
      return;
    }
    const event: OutlineEvent = { changedIds: changedIds(changes), changes };
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

function changedIds(changes: ChangeSet): Set<string> {
  const ids = new Set<string>();
  const before = new Map(changes.nodes.before.map((node) => [node.id, node]));
  const addParent = (parentId: string | null): void => {
    if (parentId !== null) {
      ids.add(parentId);
    }
  };
  for (const node of changes.nodes.upsert) {
    ids.add(node.id);
    const prev = before.get(node.id);
    if (
      prev === undefined ||
      prev.parentId !== node.parentId ||
      prev.sortKey !== node.sortKey
    ) {
      addParent(node.parentId);
      addParent(prev?.parentId ?? null);
    }
  }
  for (const id of changes.nodes.delete) {
    ids.add(id);
    addParent(before.get(id)?.parentId ?? null);
  }
  for (const state of changes.uiState.upsert) {
    ids.add(state.nodeId);
  }
  for (const id of changes.uiState.delete) {
    ids.add(id);
  }
  return ids;
}
