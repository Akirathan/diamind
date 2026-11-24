import {
  BrowserWindow,
  dialog,
  ipcMain,
  type IpcMainInvokeEvent,
  type OpenDialogOptions,
} from "electron";
import { IpcChannel } from "@/shared/api";
import type { OpenedImportFile } from "@/shared/import";
import { readImportFile } from "@/main/import/read-import-file";

const OPEN_OPTIONS: OpenDialogOptions = {
  title: "Import from Workflowy",
  buttonLabel: "Import",
  properties: ["openFile"],
  filters: [
    { name: "OPML", extensions: ["opml", "xml"] },
    { name: "All Files", extensions: ["*"] },
  ],
};

export function registerImportIpc(): void {
  ipcMain.handle(
    IpcChannel.OpenImportFile,
    async (event): Promise<OpenedImportFile> => {
      const { canceled, filePaths } = await dialog.showOpenDialog(
        windowOf(event),
        OPEN_OPTIONS,
      );
      if (canceled || filePaths.length === 0) {
        return { status: "canceled" };
      }
      return readImportFile(filePaths[0]);
    },
  );
  ipcMain.handle(
    IpcChannel.ShowImportError,
    async (event, detail: unknown): Promise<void> => {
      await dialog.showMessageBox(windowOf(event), {
        type: "error",
        message: "The import failed. Nothing was changed.",
        detail: String(detail),
      });
    },
  );
}

function windowOf(event: IpcMainInvokeEvent): BrowserWindow {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window === null) {
    throw new Error("The window is closed");
  }
  return window;
}
