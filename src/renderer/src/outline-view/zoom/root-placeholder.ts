import type { Node } from "@/shared/outline/node";
import { isEmptyNode } from "@/renderer/src/outline/commands/empty-rule";
import { cursorAt } from "@/renderer/src/outline/editing/cursor";
import { isVisible } from "@/renderer/src/outline/editing/visible-nodes";
import type { OutlineStore } from "@/renderer/src/outline/store/store";
import type { OutlineEditing } from "@/renderer/src/outline-view/editing/outline-editing";
import type { LocalRoot } from "@/renderer/src/outline-view/zoom/local-root";

/**
 * Gives a local root without children one empty child to type into.
 * While nothing changes that child, it is removed when it is not needed any more.
 */
export class RootPlaceholder {
  /** The rows as they were created. An undo brings back the same object. */
  private readonly created = new Map<string, Node>();
  private scheduled = false;

  constructor(
    private readonly store: OutlineStore,
    private readonly localRoot: LocalRoot,
    private readonly editing: OutlineEditing,
  ) {
    this.adoptSaved();
    this.update();
    store.subscribe(({ changedIds }) => {
      if (
        changedIds.has(localRoot.get()) ||
        [...this.created.keys()].some((id) => changedIds.has(id))
      ) {
        this.schedule();
      }
    });
  }

  update(): void {
    this.editing.history.untracked(() => {
      this.removeUnneeded();
      const rootId = this.localRoot.get();
      if (this.store.getChildren(rootId).length === 0) {
        const { id } = this.store.insertNode(rootId, null);
        this.created.set(id, this.store.getNode(id) as Node);
      }
    });
  }

  /** A store event can come in the middle of a transaction. */
  private schedule(): void {
    if (this.scheduled) {
      return;
    }
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      this.update();
    });
  }

  /** The placeholder of the last session, if the app quit while it was needed. */
  private adoptSaved(): void {
    const children = this.store.getChildren(this.localRoot.get());
    const child = this.store.getNode(children[0]);
    if (
      children.length === 1 &&
      child !== undefined &&
      isEmptyNode(child) &&
      child.completedAt === null &&
      child.attributes === undefined &&
      child.createdAt === child.modifiedAt
    ) {
      this.created.set(child.id, child);
    }
  }

  private removeUnneeded(): void {
    const { store, editing } = this;
    const currentId = editing.currentNode.get();
    // The current node last: if one of two placeholders can stay, it is that one.
    const ids = [...this.created.keys()].sort(
      (a, b) => Number(a === currentId) - Number(b === currentId),
    );
    let id = ids.find((candidate) => this.isUnneeded(candidate));
    while (id !== undefined) {
      const parentId = store.getNode(id)?.parentId as string;
      store.deleteNode(id);
      if (
        id === currentId &&
        isVisible(store, this.localRoot.get(), parentId)
      ) {
        const end = store.getNode(parentId)?.text.length ?? 0;
        editing.focus.request(cursorAt(parentId, end));
      }
      id = ids.find((candidate) => this.isUnneeded(candidate));
    }
  }

  private isUnneeded(id: string): boolean {
    const { store } = this;
    const node = store.getNode(id);
    if (
      node === undefined ||
      node !== this.created.get(id) ||
      node.parentId === null ||
      id === this.localRoot.get() ||
      store.getChildren(id).length > 0
    ) {
      return false;
    }
    const isOnlyChild = store.getChildren(node.parentId).length === 1;
    const needsChild =
      node.parentId === this.localRoot.get() || node.parentId === store.rootId;
    return !(isOnlyChild && needsChild);
  }
}
