import { contextBridge, ipcRenderer } from "electron";
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
};

contextBridge.exposeInMainWorld("diamind", api);
