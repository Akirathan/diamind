import type { ChangeSet } from "@/shared/outline/change-set";
import type { Node, NodeUiState } from "@/shared/outline/node";
import type { OutlineModel } from "@/renderer/src/outline/model/model";

export interface RestoreRows {
  nodes: { put: readonly Node[]; remove: readonly string[] };
  uiState: { put: readonly NodeUiState[]; remove: readonly string[] };
}

export function restoreRows(model: OutlineModel, rows: RestoreRows): ChangeSet {
  return model.record(() => {
    // Backwards, because many last siblings are faster to remove from the end.
    for (const id of rows.nodes.remove.toReversed()) {
      if (model.nodes.has(id)) {
        model.removeNode(id);
      }
    }
    for (const node of rows.nodes.put) {
      model.putNode(node);
    }
    for (const id of rows.uiState.remove) {
      model.removeUiState(id);
    }
    for (const state of rows.uiState.put) {
      model.putUiState(state);
    }
  });
}
