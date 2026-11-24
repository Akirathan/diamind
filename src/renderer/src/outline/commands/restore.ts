import type { ChangeSet } from "@/shared/outline/change-set";
import type { Node, NodeUiState } from "@/shared/outline/node";
import type { OutlineModel } from "@/renderer/src/outline/model/model";

export interface RestoreRows {
  nodes: { put: readonly Node[]; remove: readonly string[] };
  uiState: { put: readonly NodeUiState[]; remove: readonly string[] };
}

export function restoreRows(model: OutlineModel, rows: RestoreRows): ChangeSet {
  return model.record(() => {
    // Before the removals, so that children can move out of a removed node.
    for (const node of rows.nodes.put) {
      model.putNode(node);
    }
    for (const id of rows.nodes.remove) {
      removeSubtree(model, id);
    }
    for (const id of rows.uiState.remove) {
      restoreUiState(model, id, undefined);
    }
    for (const state of rows.uiState.put) {
      restoreUiState(model, state.nodeId, state);
    }
  });
}

/** The node can have children that are not in the undo history. */
function removeSubtree(model: OutlineModel, id: string): void {
  if (!model.nodes.has(id)) {
    return;
  }
  const ids = model.subtreeIds(id);
  for (let i = ids.length - 1; i >= 0; i--) {
    model.removeNode(ids[i]);
  }
}

/** The scroll position is not in the undo history, so the current one stays. */
function restoreUiState(
  model: OutlineModel,
  nodeId: string,
  state: NodeUiState | undefined,
): void {
  const scrollTop = model.uiState.get(nodeId)?.scrollTop ?? null;
  if (state !== undefined) {
    model.putUiState(
      scrollTop === null || scrollTop === state.scrollTop
        ? state
        : { ...state, scrollTop },
    );
  } else if (scrollTop === null) {
    model.removeUiState(nodeId);
  } else {
    model.putUiState({ nodeId, collapsed: false, scrollTop });
  }
}
