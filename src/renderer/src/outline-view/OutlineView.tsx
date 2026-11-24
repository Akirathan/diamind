import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { OutlineRowView } from "@/renderer/src/outline-view/OutlineRowView";
import {
  ensureVisibleNode,
  type OutlineSession,
} from "@/renderer/src/outline-view/session";

const ESTIMATED_ROW_HEIGHT = 24;
const OVERSCAN = 10;

export function OutlineView({ session }: { session: OutlineSession }) {
  const { store, rows: rowsSource } = session;
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
            <OutlineRowView
              key={item.key}
              index={item.index}
              {...rows[item.index]}
              session={session}
              measure={virtualizer.measureElement}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
