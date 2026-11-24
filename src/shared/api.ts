import type { OpenedImportFile } from "@/shared/import";
import type { MenuCommand } from "@/shared/menu";
import type { ChangeBatch } from "@/shared/outline/change-set";
import type { Node, NodeUiState } from "@/shared/outline/node";

export const IpcChannel = {
  GetAppInfo: "app:get-info",
  LoadOutline: "outline:load",
  SaveChanges: "outline:save",
  FlushRequest: "outline:flush-request",
  FlushDone: "outline:flush-done",
  OpenLink: "link:open",
  MenuCommand: "menu:command",
  OpenImportFile: "import:open-file",
  ShowImportError: "import:show-error",
} as const;

export interface AppInfo {
  version: string;
  dataDir: string;
  /** Generated nodes to seed the outline with, in development and e2e tests only. */
  devSeedNodeCount: number;
}

/** JSON text of a `T`. */
export type Json<T> = string & { readonly __json?: T };

/** All rows of `nodes` and `node_ui_state`, read at startup. */
export interface LoadedOutline {
  nodes: Node[];
  uiState: NodeUiState[];
}

/**
 * `LoadedOutline` as JSON text: IPC and the context bridge copy a few large
 * strings much faster than many objects. Nodes come in chunks to stay below
 * the maximum string length of V8.
 */
export interface OutlineJson {
  nodeChunks: Json<Node[]>[];
  uiState: Json<NodeUiState[]>;
}

export function parseOutlineJson(json: OutlineJson): LoadedOutline {
  const nodes: Node[] = [];
  for (const chunk of json.nodeChunks) {
    for (const node of JSON.parse(chunk) as Node[]) {
      nodes.push(node);
    }
  }
  return { nodes, uiState: JSON.parse(json.uiState) as NodeUiState[] };
}

export interface DiamindApi {
  getAppInfo(): Promise<AppInfo>;
  /** Parse the result with `parseOutlineJson`. */
  loadOutline(): Promise<OutlineJson>;
  /** Writes the batch in one transaction. Rejects if nothing was written. */
  saveChanges(batch: Json<ChangeBatch>): Promise<void>;
  /**
   * Registers the function that saves all unsaved changes before the window
   * closes. Returns a function that removes it.
   */
  onFlushRequest(flush: () => Promise<void>): () => void;
  /** Opens a http, https or file URL outside of the app. Rejects for any other URL. */
  openLink(url: string): Promise<void>;
  /** Calls `listener` for each selected item of the application menu. Returns a function that removes it. */
  onMenuCommand(listener: (command: MenuCommand) => void): () => void;
  /** Lets the user choose a file. Resolves with its content. */
  openImportFile(): Promise<OpenedImportFile>;
  /** Resolves when the user closes the message. */
  showImportError(message: string): Promise<void>;
}
