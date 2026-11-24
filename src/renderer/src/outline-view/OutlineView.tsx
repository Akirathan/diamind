import { useVirtualizer } from "@tanstack/react-virtual";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import type { OutlineRow } from "@/renderer/src/outline-view/flatten";
import { keepCursorRow } from "@/renderer/src/outline-view/kept-row";
import type { NodeEditors } from "@/renderer/src/outline-view/node-editors";
import { revealCursor } from "@/renderer/src/outline-view/reveal-cursor";
import {
  ensureVisibleNode,
  type OutlineSession,
} from "@/renderer/src/outline-view/session";
import { useUndoKeys } from "@/renderer/src/outline-view/undo-keys";

const ESTIMATED_ROW_HEIGHT = 24;
const OVERSCAN = 10;
const INDENT_PX = 24;

export function OutlineView({ session }: { session: OutlineSession }) {
  const { store, rows: rowsSource, editing, editors } = session;
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
    () => keepCursorRow(rows, focus),
    [rows, focus, focusRequest],
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
            <RowView
              key={item.key}
              index={item.index}
              row={rows[item.index]}
              gapAbove={i > 0 ? item.start - items[i - 1].end : 0}
              editors={editors}
              measure={virtualizer.measureElement}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface RowViewProps {
  index: number;
  row: OutlineRow;
  /** The height of the rows above that are not rendered. */
  gapAbove: number;
  editors: NodeEditors;
  measure: (element: HTMLElement | null) => void;
}

const RowView = memo(function RowView({
  index,
  row,
  gapAbove,
  editors,
  measure,
}: RowViewProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const parent = editorRef.current;
    if (parent === null) {
      return;
    }
    const view = editors.mount(row.id, parent);
    return () => {
      editors.unmount(row.id, view);
    };
  }, [editors, row.id]);

  return (
    <div
      ref={measure}
      data-index={index}
      data-node-id={row.id}
      className="flex items-start py-0.5 leading-5"
      style={{ marginTop: gapAbove, paddingLeft: row.depth * INDENT_PX }}
    >
      <span className="mr-2 flex h-[1lh] shrink-0 items-center">
        <span
          data-testid="bullet"
          className="size-1.5 rounded-full bg-neutral-500"
        />
      </span>
      <div ref={editorRef} className="min-w-0 flex-1" />
    </div>
  );
});
