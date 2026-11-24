import { memo, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { OutlineRow } from "@/renderer/src/outline-view/rows/flatten";
import { indentLineSegments } from "@/renderer/src/outline-view/rows/indent-lines";
import type { OutlineSession } from "@/renderer/src/outline-view/session";

const INDENT_PX = 24;
/** From the left edge of a row of depth 0 to the center of its bullet. */
const BULLET_CENTER_PX = 24;

interface OutlineRowViewProps extends OutlineRow {
  index: number;
  /** The height of the rows above that are not rendered. */
  gapAbove: number;
  session: OutlineSession;
  measure: (element: HTMLElement | null) => void;
}

/** Takes the row as primitive props, so an unchanged row does not render again. */
export const OutlineRowView = memo(function OutlineRowView({
  index,
  id,
  depth,
  hasChildren,
  collapsed,
  isTitle = false,
  gapAbove,
  session,
  measure,
}: OutlineRowViewProps) {
  const { store, editors, currentIndentLine, zoom } = session;
  const editorRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const parent = editorRef.current;
    if (parent === null) {
      return;
    }
    const view = editors.mount(id, parent);
    return () => {
      editors.unmount(id, view);
    };
  }, [editors, id]);

  return (
    <div
      ref={measure}
      data-index={index}
      data-node-id={id}
      data-title={isTitle}
      className="relative flex items-start py-0.5 leading-5 data-[title=true]:py-2 data-[title=true]:text-2xl data-[title=true]:font-semibold"
      style={{ marginTop: gapAbove, paddingLeft: depth * INDENT_PX }}
    >
      <IndentLines
        id={id}
        depth={depth}
        currentIndentLine={currentIndentLine}
      />
      <span className="flex h-[1lh] w-4 shrink-0 items-center">
        {hasChildren && !isTitle && (
          <CollapseArrow
            collapsed={collapsed}
            onToggle={() => store.setCollapsed(id, !collapsed)}
          />
        )}
      </span>
      {!isTitle && (
        <span className="mr-1 flex h-[1lh] w-4 shrink-0 items-center justify-center">
          <Bullet collapsed={collapsed} onZoom={() => zoom.zoomTo(id)} />
        </span>
      )}
      <div ref={editorRef} className="min-w-0 flex-1" />
    </div>
  );
});

interface IndentLinesProps {
  id: string;
  depth: number;
  currentIndentLine: OutlineSession["currentIndentLine"];
}

function IndentLines({ id, depth, currentIndentLine }: IndentLinesProps) {
  const currentLevel = useSyncExternalStore(currentIndentLine.subscribe, () =>
    currentIndentLine.levelInRow(id, depth),
  );
  return indentLineSegments(depth, currentLevel).map(({ level, current }) => (
    <span
      key={level}
      aria-hidden
      data-testid="indent-line"
      data-level={level}
      data-current={current}
      className="pointer-events-none absolute inset-y-0 w-px bg-neutral-200 data-[current=true]:bg-neutral-500 dark:bg-neutral-700 dark:data-[current=true]:bg-neutral-400"
      style={{ left: level * INDENT_PX + BULLET_CENTER_PX }}
    />
  ));
}

interface CollapseArrowProps {
  collapsed: boolean;
  onToggle: () => void;
}

function CollapseArrow({ collapsed, onToggle }: CollapseArrowProps) {
  return (
    <button
      type="button"
      aria-label="Show children"
      aria-expanded={!collapsed}
      // Keeps the focus and the cursor in the editor.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onToggle}
      className="flex size-4 items-center justify-center rounded-sm text-neutral-400 hover:text-neutral-800 dark:text-neutral-500 dark:hover:text-neutral-200"
    >
      <svg
        aria-hidden
        viewBox="0 0 8 8"
        className={`size-2 fill-current ${collapsed ? "" : "rotate-90"}`}
      >
        <path d="M2 0.5 L6.5 4 L2 7.5 Z" />
      </svg>
    </button>
  );
}

interface BulletProps {
  collapsed: boolean;
  onZoom: () => void;
}

/** A collapsed node has a ring around the bullet. */
function Bullet({ collapsed, onZoom }: BulletProps) {
  return (
    <button
      type="button"
      aria-label="Zoom in"
      // Keeps the focus and the cursor in the editor.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onZoom}
      className="group flex size-4 cursor-pointer items-center justify-center rounded-full"
    >
      <span
        data-testid="bullet"
        data-collapsed={collapsed}
        className="size-1.5 rounded-full bg-neutral-500 ring-neutral-300 group-hover:bg-neutral-800 group-hover:ring-4 data-[collapsed=true]:ring-4 dark:bg-neutral-400 dark:ring-neutral-600 dark:group-hover:bg-neutral-100"
      />
    </button>
  );
}
