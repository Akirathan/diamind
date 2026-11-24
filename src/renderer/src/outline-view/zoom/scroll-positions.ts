import type { UndoHistory } from "@/renderer/src/outline/history/undo";
import type { OutlineStore } from "@/renderer/src/outline/store/store";
import type { LocalRoot } from "@/renderer/src/outline-view/zoom/local-root";

/** Remembers the scroll position of each local root. */
export class ScrollPositions {
  private scroller: HTMLElement | null = null;

  constructor(
    private readonly store: OutlineStore,
    private readonly localRoot: LocalRoot,
    private readonly history: UndoHistory,
  ) {}

  /** Returns a function that detaches the scroller. */
  attach(scroller: HTMLElement): () => void {
    const onScrollEnd = (): void => this.save();
    this.scroller = scroller;
    scroller.addEventListener("scrollend", onScrollEnd);
    return () => {
      scroller.removeEventListener("scrollend", onScrollEnd);
      this.scroller = null;
    };
  }

  /** The saved scroll position of the local root, 0 for the top. */
  get(): number {
    return this.store.getUiState(this.localRoot.get())?.scrollTop ?? 0;
  }

  save(): void {
    const rootId = this.localRoot.get();
    const { scroller, store } = this;
    if (scroller !== null && store.getNode(rootId) !== undefined) {
      const scrollTop = Math.round(scroller.scrollTop);
      this.history.untracked(() => store.setScrollTop(rootId, scrollTop));
    }
  }

  restore(): void {
    if (this.scroller !== null) {
      this.scroller.scrollTop = this.get();
    }
  }
}
