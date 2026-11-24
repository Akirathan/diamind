import { useEffect } from "react";
import type { UndoHistory } from "@/renderer/src/outline/history/undo";

/**
 * Binds undo and redo of the outline. The event is always prevented, so the
 * native undo of the application menu does not run too.
 */
export function useUndoKeys(history: UndoHistory): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.defaultPrevented || !isOutlineTarget(event.target)) {
        return;
      }
      const action = actionOfKey(event);
      if (action !== null) {
        event.preventDefault();
        history[action]();
      }
    }

    // Undo and Redo clicked in the application menu.
    function onBeforeInput(event: InputEvent): void {
      if (!isOutlineTarget(event.target)) {
        return;
      }
      if (event.inputType === "historyUndo") {
        event.preventDefault();
        history.undo();
      }
      if (event.inputType === "historyRedo") {
        event.preventDefault();
        history.redo();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("beforeinput", onBeforeInput, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("beforeinput", onBeforeInput, true);
    };
  }, [history]);
}

function actionOfKey(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  isComposing: boolean;
}): "undo" | "redo" | null {
  const isMac = navigator.platform.startsWith("Mac");
  const mod = isMac ? event.metaKey : event.ctrlKey;
  const otherMod = isMac ? event.ctrlKey : event.metaKey;
  if (
    !mod ||
    otherMod ||
    event.altKey ||
    event.isComposing ||
    event.key.toLowerCase() !== "z"
  ) {
    return null;
  }
  return event.shiftKey ? "redo" : "undo";
}

/** Text inputs outside of the outline keep their own undo. */
function isOutlineTarget(target: EventTarget | null): boolean {
  return !(
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
  );
}
