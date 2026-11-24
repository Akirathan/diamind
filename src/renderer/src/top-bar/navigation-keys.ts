import { useEffect } from "react";
import type { Zoom } from "@/renderer/src/outline-view/zoom/zoom";

const isMac = navigator.platform.startsWith("Mac");

export const navigationKeyLabels = {
  back: isMac ? "⌘[" : "Ctrl+[",
  forward: isMac ? "⌘]" : "Ctrl+]",
};

export function useNavigationKeys(zoom: Zoom): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const mod = isMac ? event.metaKey : event.ctrlKey;
      const otherMod = isMac ? event.ctrlKey : event.metaKey;
      if (!mod || otherMod || event.altKey || event.shiftKey) {
        return;
      }
      // The key position: some layouts have no bracket without a modifier.
      if (event.code === "BracketLeft") {
        event.preventDefault();
        zoom.back();
      }
      if (event.code === "BracketRight") {
        event.preventDefault();
        zoom.forward();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zoom]);
}
