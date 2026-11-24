import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { MenuCommand } from "@/shared/menu";
import { IpcChannel, type DiamindApi } from "@/shared/api";

let flushChanges: (() => Promise<void>) | null = null;

ipcRenderer.on(IpcChannel.FlushRequest, async () => {
  await flushChanges?.();
  ipcRenderer.send(IpcChannel.FlushDone);
});

const api: DiamindApi = {
  getAppInfo: () => ipcRenderer.invoke(IpcChannel.GetAppInfo),
  loadOutline: () => ipcRenderer.invoke(IpcChannel.LoadOutline),
  saveChanges: (batch) => ipcRenderer.invoke(IpcChannel.SaveChanges, batch),
  onFlushRequest: (flush) => {
    flushChanges = flush;
    return () => {
      if (flushChanges === flush) {
        flushChanges = null;
      }
    };
  },
  openLink: (url) => ipcRenderer.invoke(IpcChannel.OpenLink, url),
  onMenuCommand: (listener) => {
    function onCommand(_event: IpcRendererEvent, command: MenuCommand): void {
      listener(command);
    }
    ipcRenderer.on(IpcChannel.MenuCommand, onCommand);
    return () => {
      ipcRenderer.off(IpcChannel.MenuCommand, onCommand);
    };
  },
};

contextBridge.exposeInMainWorld("diamind", api);
