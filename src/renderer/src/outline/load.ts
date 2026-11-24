import { generateKeyBetween } from "fractional-indexing";
import { emptyChangeSet, type ChangeSet } from "@/shared/outline/change-set";
import type { Node, NodeUiState } from "@/shared/outline/node";
import { OutlineError } from "@/renderer/src/outline/errors";
import {
  OutlineModel,
  type OutlineOptions,
} from "@/renderer/src/outline/model";
import { compareSortKeys } from "@/renderer/src/outline/sort-keys";

export interface OutlineRows {
  nodes: readonly Node[];
  uiState?: readonly NodeUiState[];
}

/**
 * Builds the model from the rows read at startup.
 * For an empty outline it creates the global root; `changes` then holds it.
 */
export function loadModel(
  rows: OutlineRows,
  options: OutlineOptions = {},
): { model: OutlineModel; changes: ChangeSet } {
  const model = new OutlineModel(options);
  if (rows.nodes.length === 0) {
    const now = model.now();
    const root: Node = {
      id: model.newId(),
      parentId: null,
      sortKey: generateKeyBetween(null, null),
      type: "text",
      format: "bullet",
      text: "",
      note: "",
      completedAt: null,
      attachmentId: null,
      createdAt: now,
      modifiedAt: now,
    };
    model.rootId = root.id;
    const changes = model.record(() => model.putNode(root));
    return { model, changes };
  }

  for (const node of rows.nodes) {
    if (model.nodes.has(node.id)) {
      throw invalid(`Duplicate node ${node.id}`);
    }
    model.nodes.set(node.id, node);
    if (node.parentId === null) {
      if (model.rootId !== "") {
        throw invalid("More than one global root");
      }
      model.rootId = node.id;
    }
  }
  if (model.rootId === "") {
    throw invalid("No global root");
  }
  buildChildren(model);
  if (model.subtreeIds(model.rootId).length !== model.nodes.size) {
    throw invalid("Some nodes are not reachable from the global root");
  }

  for (const state of rows.uiState ?? []) {
    if (model.nodes.has(state.nodeId)) {
      model.uiState.set(state.nodeId, state);
    }
  }
  return { model, changes: emptyChangeSet() };
}

function buildChildren(model: OutlineModel): void {
  for (const node of model.nodes.values()) {
    if (node.parentId !== null && !model.nodes.has(node.parentId)) {
      throw invalid(`Node ${node.id} has a missing parent ${node.parentId}`);
    }
    let siblings = model.children.get(node.parentId);
    if (siblings === undefined) {
      siblings = [];
      model.children.set(node.parentId, siblings);
    }
    siblings.push(node.id);
  }
  for (const siblings of model.children.values()) {
    siblings.sort((a, b) =>
      compareSortKeys(model.getNode(a), model.getNode(b)),
    );
  }
}

function invalid(message: string): OutlineError {
  return new OutlineError("invalidOutline", message);
}
