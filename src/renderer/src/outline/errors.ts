export type OutlineErrorCode =
  | "invalidOutline"
  | "nodeNotFound"
  | "rootNotAllowed"
  | "afterNotChild"
  | "noPreviousSibling"
  | "parentIsRoot"
  | "moveIntoSelf"
  | "emptyTail"
  | "invalidFormat"
  | "attachmentText"
  | "invalidAttributeKey"
  | "invalidAttributeValue";

/** Thrown by a command that breaks a rule. The model is then unchanged. */
export class OutlineError extends Error {
  readonly code: OutlineErrorCode;

  constructor(code: OutlineErrorCode, message: string) {
    super(message);
    this.name = "OutlineError";
    this.code = code;
  }
}
