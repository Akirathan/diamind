import type { Node, NodeUiState } from "./outline/node";

export const IpcChannel = {
  GetAppInfo: "app:get-info",
  LoadOutline: "outline:load",
} as const;

export interface AppInfo {
  version: string;
  dataDir: string;
}

/** All rows of `nodes` and `node_ui_state`, read at startup. */
export interface LoadedOutline {
  nodes: Node[];
  uiState: NodeUiState[];
}

export interface DiamindApi {
  getAppInfo(): Promise<AppInfo>;
  loadOutline(): Promise<LoadedOutline>;
}
