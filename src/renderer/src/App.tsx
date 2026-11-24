import { useEffect, useState } from "react";
import { OutlineView } from "@/renderer/src/outline-view/OutlineView";
import {
  createOutlineSession,
  loadStartupOutline,
  type OutlineSession,
} from "@/renderer/src/outline-view/session";

export function App() {
  const [session, setSession] = useState<OutlineSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let opened: OutlineSession | null = null;

    async function open(): Promise<void> {
      const startup = await loadStartupOutline(window.diamind);
      if (!cancelled) {
        opened = createOutlineSession(startup, window.diamind);
        setSession(opened);
      }
    }

    open().catch((error: unknown) => {
      console.error("Loading the outline failed", error);
      if (!cancelled) {
        setLoadError(String(error));
      }
    });
    return () => {
      cancelled = true;
      opened?.stopSaving();
    };
  }, []);

  return (
    <main className="h-screen bg-white text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
      {session !== null && <OutlineView session={session} />}
      {loadError !== null && (
        <p role="alert" className="p-6 text-red-700 dark:text-red-400">
          The outline could not be loaded. {loadError}
        </p>
      )}
    </main>
  );
}
