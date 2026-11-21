export const IpcChannel = {
  GetAppInfo: "app:get-info",
} as const;

export interface AppInfo {
  version: string;
  dataDir: string;
  /** Generated nodes to seed the outline with, in development and e2e tests only. */
  devSeedNodeCount: number;
}

export interface DiamindApi {
  getAppInfo(): Promise<AppInfo>;
}
