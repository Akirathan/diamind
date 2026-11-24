import { contextBridge, ipcRenderer } from "electron";
import { IpcChannel, type DiamindApi } from "@/shared/api";

const api: DiamindApi = {
  getAppInfo: () => ipcRenderer.invoke(IpcChannel.GetAppInfo),
  loadOutline: () => ipcRenderer.invoke(IpcChannel.LoadOutline),
  openLink: (url) => ipcRenderer.invoke(IpcChannel.OpenLink, url),
};

contextBridge.exposeInMainWorld("diamind", api);
