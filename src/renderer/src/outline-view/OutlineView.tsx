import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { keepCurrentRow } from "@/renderer/src/outline-view/rows/kept-row";
import type { OutlineRow } from "@/renderer/src/outline-view/rows/flatten";
import { OutlineRowView } from "@/renderer/src/outline-view/rows/OutlineRowView";
import { revealCursor } from "@/renderer/src/outline-view/focus/reveal-cursor";
import type { OutlineSession } from "@/renderer/src/outline-view/session";
import { useUndoKeys } from "@/renderer/src/outline-view/editing/undo-keys";

const ESTIMATED_ROW_HEIGHT = 24;
const OVERSCAN = 10;

export function OutlineView({ session }: { session: OutlineSession }) {
  const {
    rows: rowsSource,
    editing,
    editors,
    currentNode,
    localRoot,
    scrollPositions,
  } = session;
  const { focus, history } = editing;
  const rows = useSyncExternalStore(rowsSource.subscribe, rowsSource.getRows);
  const rootId = useSyncExternalStore(localRoot.subscribe, localRoot.get);
  const focusRequest = useSyncExternalStore(focus.subscribe, focus.getRequest);
  const scrollRef = useRef<HTMLDivElement>(null);
  useUndoKeys(history);

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
    getItemKey: useCallback((index: number) => rowKey(rows[index]), [rows]),
  });
  const items = virtualizer.getVirtualItems();

  useLayoutEffect(() => {
    if (scrollRef.current !== null) {
      return scrollPositions.attach(scrollRef.current);
    }
  }, [scrollPositions]);

  // After the effect of the virtualizer, which can scroll too.
  useLayoutEffect(() => {
    scrollPositions.restore();
  }, [rootId, scrollPositions]);

  useLayoutEffect(() => {
    if (focusRequest === null) {
      return;
    }
    const view = editors.focus(focusRequest);
    if (
      view !== null &&
      scrollRef.current !== null &&
      focusRequest.keepScroll !== true
    ) {
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

/** The title has another height than the row of the same node. */
function rowKey({ id, isTitle }: OutlineRow): string {
  return isTitle === true ? `title:${id}` : id;
}
