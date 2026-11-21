import { useEffect, useState } from "react";
import type { AppInfo } from "../../shared/api";

export function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    void window.diamind.getAppInfo().then(setInfo);
  }, []);

  return (
    <main className="flex h-screen flex-col items-center justify-center gap-2 bg-white text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
      <h1 className="text-2xl font-semibold">DiaMind</h1>
      {info !== null && (
        <p className="text-sm text-neutral-500">
          v{info.version} · data: {info.dataDir}
        </p>
      )}
    </main>
  );
}
