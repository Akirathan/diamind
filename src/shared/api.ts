export const IpcChannel = {
  GetAppInfo: "app:get-info",
} as const;

export interface AppInfo {
  version: string;
  dataDir: string;
}

export interface DiamindApi {
  getAppInfo(): Promise<AppInfo>;
}
