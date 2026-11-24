export type OpenedImportFile =
  | { status: "canceled" }
  | { status: "failed"; message: string }
  | { status: "opened"; text: string };
