import type { BrowserWindow } from "electron";
import { IpcChannel } from "@/shared/api";

const FLUSH_TIMEOUT_MS = 5000;

/**
 * Delays the close of the window until the renderer has saved its changes.
 * A renderer that does not answer in time is closed anyway.
 */
export function saveBeforeClose(
  window: BrowserWindow,
  hasOutline: () => boolean,
): void {
  let closing = false;

  window.on("close", (event) => {
    if (window.webContents.isCrashed() || !hasOutline()) {
      return;
    }
    event.preventDefault();
    if (closing) {
      return;
    }
    closing = true;
    void requestFlush(window).then(() => {
      if (!window.isDestroyed()) {
        window.destroy();
      }
    });
  });
}

function requestFlush(window: BrowserWindow): Promise<void> {
  const { webContents } = window;
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.error("The window did not save its changes in time");
      resolve();
    }, FLUSH_TIMEOUT_MS);

    function finish(): void {
      clearTimeout(timeout);
      resolve();
    }

    webContents.ipc.once(IpcChannel.FlushDone, finish);
    webContents.once("render-process-gone", finish);
    window.once("closed", finish);
    webContents.send(IpcChannel.FlushRequest);
  });
}
