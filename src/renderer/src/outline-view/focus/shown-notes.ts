import type { CurrentNode } from "@/renderer/src/outline-view/focus/current-node";
import type { NodeFocus } from "@/renderer/src/outline-view/focus/node-focus";
import type { OutlineStore } from "@/renderer/src/outline/store/store";

/** Knows which notes are shown: the ones with text, and the one with the cursor. */
export class ShownNotes {
  /** The node with the cursor in its note. */
  private openId: string | null = null;
  private readonly listeners = new Map<string, Set<() => void>>();
  private readonly unsubscribes: (() => void)[];

  constructor(
    private readonly store: OutlineStore,
    private readonly focus: NodeFocus,
    currentNode: CurrentNode,
  ) {
    this.unsubscribes = [
      store.subscribe((event) => {
        for (const id of event.changedIds) {
          this.notify(id);
        }
      }),
      focus.subscribeField(() => this.updateOpen()),
      currentNode.subscribe(() => this.updateOpen()),
    ];
  }

  isShown(nodeId: string): boolean {
    const note = this.store.getNode(nodeId)?.note ?? "";
    return note !== "" || nodeId === this.openId;
  }

  /** Notifies only about this node, so a change does not touch the other rows. */
  subscribe(nodeId: string, listener: () => void): () => void {
    const listeners = this.listeners.get(nodeId) ?? new Set();
    this.listeners.set(nodeId, listeners);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && this.listeners.get(nodeId) === listeners) {
        this.listeners.delete(nodeId);
      }
    };
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribes) {
      unsubscribe();
    }
    this.listeners.clear();
  }

  private updateOpen(): void {
    const { cursor } = this.focus;
    const previousId = this.openId;
    this.openId = cursor?.field === "note" ? cursor.nodeId : null;
    if (this.openId === previousId) {
      return;
    }
    for (const id of [previousId, this.openId]) {
      if (id !== null) {
        this.notify(id);
      }
    }
  }

  private notify(nodeId: string): void {
    for (const listener of this.listeners.get(nodeId) ?? []) {
      listener();
    }
  }
}
