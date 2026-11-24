import {
  _electron as electron,
  type ElectronApplication,
} from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MenuCommand } from "@/shared/menu";

export interface LaunchedApp {
  app: ElectronApplication;
  dataDir: string;
  /** Quits the app and starts it again with the same data directory. Replaces `app`. */
  restart(extraEnv?: Record<string, string>): Promise<void>;
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

  function start(): Promise<ElectronApplication> {
    return electron.launch({ args: ["."], env });
  }

  const launched: LaunchedApp = {
    app: await start(),
    dataDir,
    restart: async (restartEnv = {}) => {
      await launched.app.close();
      Object.assign(env, restartEnv);
      launched.app = await start();
    },
    close: async () => {
      await launched.app.close();
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
  return launched;
}

export async function clickMenuItem(
  app: ElectronApplication,
  command: MenuCommand,
): Promise<void> {
  await app.evaluate(({ Menu }, id) => {
    const item = Menu.getApplicationMenu()?.getMenuItemById(id);
    if (!item?.enabled) {
      throw new Error(`The menu item ${id} is missing or disabled`);
    }
    item.click();
  }, command);
}
