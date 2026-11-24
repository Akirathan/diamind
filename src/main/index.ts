import { app, BrowserWindow, ipcMain, shell, type WebContents } from "electron";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { IpcChannel, type AppInfo, type Json } from "@/shared/api";
import type { ChangeBatch } from "@/shared/outline/change-set";
import { openDatabase, type Db } from "@/main/db/database";
import { applyChangeSet, loadOutline } from "@/main/db/outline";
import { resolveHidden, resolveSeedNodeCount } from "@/main/dev-options";
import { openLink } from "@/main/open-link";
import { resolveDataDir } from "@/main/paths";
import { saveBeforeClose } from "@/main/save-before-close";

const dataDir = resolveDataDir();
mkdirSync(dataDir, { recursive: true });
// Also scopes the single instance lock, so e2e tests with their own data dir do not collide with a running app.
app.setPath("userData", join(dataDir, "electron"));

const hidden = resolveHidden(process.env, app.isPackaged);
if (hidden) {
  app.dock?.hide();
}

let mainWindow: BrowserWindow | null = null;
let quitting = false;
/** Only these can have unsaved changes. */
const withOutline = new WeakSet<WebContents>();

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    title: "DiaMind",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // Chromium slows down timers and frames of a hidden window.
      backgroundThrottling: !hidden,
    },
  });

  window.once("ready-to-show", () => {
    if (!hidden) {
      window.show();
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== window.webContents.getURL()) {
      event.preventDefault();
    }
  });
  saveBeforeClose(window, () => withOutline.has(window.webContents));
  window.on("closed", () => {
    mainWindow = null;
  });

  const devServerUrl = process.env.ELECTRON_RENDERER_URL;
  if (devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }
  return window;
}

function registerIpc(db: Db): void {
  ipcMain.handle(IpcChannel.GetAppInfo, (): AppInfo => ({
    version: app.getVersion(),
    dataDir,
    devSeedNodeCount: resolveSeedNodeCount(process.env, app.isPackaged),
  }));
  ipcMain.handle(IpcChannel.LoadOutline, (event) => {
    withOutline.add(event.sender);
    return loadOutline(db);
  });
  ipcMain.handle(
    IpcChannel.SaveChanges,
    (_event, batch: Json<ChangeBatch>): void => {
      applyChangeSet(db, JSON.parse(batch) as ChangeBatch);
    },
  );
  ipcMain.handle(IpcChannel.OpenLink, (_event, url: unknown) =>
    openLink(url, shell),
  );
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow === null) {
      return;
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  });

  app.on("before-quit", () => {
    quitting = true;
  });

  // The delayed close of a window cancels the quit, so it starts again here.
  app.on("window-all-closed", () => {
    if (quitting || process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (mainWindow === null) {
      mainWindow = createWindow();
    }
  });

  void app.whenReady().then(() => {
    const db = openDatabase(
      join(dataDir, "diamind.db"),
      join(__dirname, "migrations"),
    );
    app.on("will-quit", () => {
      db.$client.close();
    });
    registerIpc(db);
    mainWindow = createWindow();
  });
}
