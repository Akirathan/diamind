import { useVirtualizer } from "@tanstack/react-virtual";
import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import type { OutlineRow } from "@/renderer/src/outline-view/flatten";
import type { NodeEditors } from "@/renderer/src/outline-view/node-editors";
import {
  ensureVisibleNode,
  type OutlineSession,
} from "@/renderer/src/outline-view/session";

const ESTIMATED_ROW_HEIGHT = 28;
const OVERSCAN = 10;
const INDENT_PX = 24;

export function OutlineView({ session }: { session: OutlineSession }) {
  const { store, rows: rowsSource, editors } = session;
  const rows = useSyncExternalStore(rowsSource.subscribe, rowsSource.getRows);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (rows.length === 0) {
      ensureVisibleNode(store, store.rootId);
    }
  }, [rows, store]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN,
    getItemKey: (index) => rows[index].id,
  });
  const items = virtualizer.getVirtualItems();

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
          {items.map((item) => (
            <RowView
              key={item.key}
              index={item.index}
              row={rows[item.index]}
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
  editors: NodeEditors;
  measure: (element: HTMLElement | null) => void;
}

const RowView = memo(function RowView({
  index,
  row,
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
      className="flex items-start py-0.5"
      style={{ paddingLeft: row.depth * INDENT_PX }}
    >
      <span className="mt-[0.6lh] mr-2 size-1.5 shrink-0 rounded-full bg-neutral-500" />
      <div ref={editorRef} className="min-w-0 flex-1" />
    </div>
  );
});
