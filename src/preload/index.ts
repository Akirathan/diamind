import { contextBridge, ipcRenderer } from "electron";
import { IpcChannel, type DiamindApi } from "../shared/api";

const api: DiamindApi = {
  getAppInfo: () => ipcRenderer.invoke(IpcChannel.GetAppInfo),
};

contextBridge.exposeInMainWorld("diamind", api);
