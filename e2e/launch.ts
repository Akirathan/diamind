import {
  _electron as electron,
  type ElectronApplication,
} from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface LaunchedApp {
  app: ElectronApplication;
  dataDir: string;
  close(): Promise<void>;
}

/** Starts the built app with its own data directory, hidden unless `DIAMIND_HIDDEN=0`. */
export async function launchApp(
  extraEnv: Record<string, string> = {},
): Promise<LaunchedApp> {
  const dataDir = mkdtempSync(join(tmpdir(), "diamind-e2e-"));
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== "ELECTRON_RENDERER_URL") {
      env[key] = value;
    }
  }
  env.DIAMIND_DATA_DIR = dataDir;
  env.DIAMIND_HIDDEN ??= "1";
  Object.assign(env, extraEnv);
  const app = await electron.launch({ args: ["."], env });
  return {
    app,
    dataDir,
    close: async () => {
      await app.close();
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}
