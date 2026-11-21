import { app, BrowserWindow, ipcMain } from "electron";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { IpcChannel, type AppInfo } from "../shared/api";
import { resolveDataDir } from "./paths";

const dataDir = resolveDataDir();
mkdirSync(dataDir, { recursive: true });
// Also scopes the single instance lock, so e2e tests with their own data dir do not collide with a running app.
app.setPath("userData", join(dataDir, "electron"));

let mainWindow: BrowserWindow | null = null;

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
    },
  });

  window.once("ready-to-show", () => {
    window.show();
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== window.webContents.getURL()) {
      event.preventDefault();
    }
  });
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

function registerIpc(): void {
  ipcMain.handle(IpcChannel.GetAppInfo, (): AppInfo => ({
    version: app.getVersion(),
    dataDir,
  }));
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

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (mainWindow === null) {
      mainWindow = createWindow();
    }
  });

  void app.whenReady().then(() => {
    registerIpc();
    mainWindow = createWindow();
  });
}
