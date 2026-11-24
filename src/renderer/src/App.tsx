import { useEffect, useState } from "react";
import { OutlineView } from "@/renderer/src/outline-view/OutlineView";
import {
  createOutlineSession,
  type OutlineSession,
} from "@/renderer/src/outline-view/session";

export function App() {
  const [session, setSession] = useState<OutlineSession | null>(null);

  useEffect(() => {
    let cancelled = false;
    void window.diamind.getAppInfo().then((info) => {
      if (!cancelled) {
        setSession(createOutlineSession(info.devSeedNodeCount));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="h-screen bg-white text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
      {session !== null && <OutlineView session={session} />}
    </main>
  );
}
