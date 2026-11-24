import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { keepCurrentRow } from "@/renderer/src/outline-view/kept-row";
import { OutlineRowView } from "@/renderer/src/outline-view/OutlineRowView";
import { revealCursor } from "@/renderer/src/outline-view/reveal-cursor";
import {
  ensureVisibleNode,
  type OutlineSession,
} from "@/renderer/src/outline-view/session";
import { useUndoKeys } from "@/renderer/src/outline-view/undo-keys";

const ESTIMATED_ROW_HEIGHT = 24;
const OVERSCAN = 10;

export function OutlineView({ session }: { session: OutlineSession }) {
  const { store, rows: rowsSource, editing, editors, currentNode } = session;
  const { focus, history } = editing;
  const rows = useSyncExternalStore(rowsSource.subscribe, rowsSource.getRows);
  const focusRequest = useSyncExternalStore(focus.subscribe, focus.getRequest);
  const scrollRef = useRef<HTMLDivElement>(null);
  useUndoKeys(history);

  useEffect(() => {
    if (rows.length === 0) {
      history.untracked(() => ensureVisibleNode(store, store.rootId));
    }
  }, [rows, store, history]);

  // A new extractor makes the virtualizer compute the rendered rows again.
  const rangeExtractor = useMemo(
    () => keepCurrentRow(rows, currentNode),
    [rows, currentNode, focusRequest],
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN,
    rangeExtractor,
    getItemKey: useCallback((index: number) => rows[index].id, [rows]),
  });
  const items = virtualizer.getVirtualItems();

  useLayoutEffect(() => {
    if (focusRequest === null) {
      return;
    }
    const view = editors.focus(focusRequest);
    if (view !== null && scrollRef.current !== null) {
      revealCursor(view, scrollRef.current);
    }
  }, [focusRequest, editors]);

  return (
    <div
      ref={scrollRef}
      data-testid="outline"
      className="h-full overflow-y-auto"
    >
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        <div
          className="absolute top-0 left-0 w-full px-6"
          style={{ transform: `translateY(${items[0]?.start ?? 0}px)` }}
        >
          {items.map((item, i) => (
            <OutlineRowView
              key={item.key}
              index={item.index}
              {...rows[item.index]}
              gapAbove={i > 0 ? item.start - items[i - 1].end : 0}
              session={session}
              measure={virtualizer.measureElement}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
