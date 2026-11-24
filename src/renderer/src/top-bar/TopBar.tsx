import { useSyncExternalStore } from "react";
import type { Zoom } from "@/renderer/src/outline-view/zoom/zoom";
import {
  navigationKeyLabels,
  useNavigationKeys,
} from "@/renderer/src/top-bar/navigation-keys";

const BACK_PATH = "M10 3 L5 8 L10 13";
const FORWARD_PATH = "M6 3 L11 8 L6 13";
const UP_PATH = "M3 10 L8 5 L13 10";

export function TopBar({ zoom }: { zoom: Zoom }) {
  const { canGoBack, canGoForward, canGoUp } = useSyncExternalStore(
    zoom.subscribe,
    zoom.getState,
  );
  useNavigationKeys(zoom);

  return (
    <header className="flex h-10 shrink-0 items-center gap-2 border-b border-neutral-200 px-4 dark:border-neutral-700">
      <nav aria-label="Navigation" className="flex">
        <NavigationButton
          label="Back"
          shortcut={navigationKeyLabels.back}
          path={BACK_PATH}
          enabled={canGoBack}
          onClick={() => zoom.back()}
        />
        <NavigationButton
          label="Forward"
          shortcut={navigationKeyLabels.forward}
          path={FORWARD_PATH}
          enabled={canGoForward}
          onClick={() => zoom.forward()}
        />
        <NavigationButton
          label="Up"
          path={UP_PATH}
          enabled={canGoUp}
          onClick={() => zoom.up()}
        />
      </nav>
    </header>
  );
}

interface NavigationButtonProps {
  label: string;
  shortcut?: string;
  path: string;
  enabled: boolean;
  onClick: () => void;
}

function NavigationButton({
  label,
  shortcut,
  path,
  enabled,
  onClick,
}: NavigationButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={shortcut === undefined ? label : `${label} (${shortcut})`}
      disabled={!enabled}
      // Keeps the focus and the cursor in the editor.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-sm text-neutral-600 enabled:hover:bg-neutral-200 disabled:text-neutral-300 dark:text-neutral-300 dark:enabled:hover:bg-neutral-700 dark:disabled:text-neutral-600"
    >
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="size-4 fill-none stroke-current stroke-2"
      >
        <path d={path} />
      </svg>
    </button>
  );
}
