import { useCallback, useEffect } from "react";
import { useMenuCommand } from "@/renderer/src/menu/menu-command";
import type { UndoHistory } from "@/renderer/src/outline/history/undo";

type UndoAction = "undo" | "redo";

/** Binds undo and redo of the outline to the keys and to the application menu. */
export function useUndo(history: UndoHistory): void {
  useMenuCommand(
    "undo",
    useCallback(() => runMenuAction(history, "undo"), [history]),
  );
  useMenuCommand(
    "redo",
    useCallback(() => runMenuAction(history, "redo"), [history]),
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.defaultPrevented || hasOwnUndo(event.target)) {
        return;
      }
      const action = actionOfKey(event);
      if (action !== null) {
        // A prevented key does not trigger the accelerator of the menu item.
        event.preventDefault();
        history[action]();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [history]);
}

function runMenuAction(history: UndoHistory, action: UndoAction): void {
  if (hasOwnUndo(document.activeElement)) {
    document.execCommand(action);
  } else {
    history[action]();
  }
}

function actionOfKey(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  isComposing: boolean;
}): UndoAction | null {
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

/** Text inputs outside of the outline keep their native undo. */
function hasOwnUndo(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
  );
}
