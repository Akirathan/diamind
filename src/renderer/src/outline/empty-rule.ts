import type { Node } from "../../../shared/outline/node";
import { OutlineError } from "./errors";

/** An attachment node always shows its attachment, so it is never empty. */
export function isEmptyNode(node: Node): boolean {
  return node.type === "text" && node.text === "" && node.note === "";
}

function hasEmptyTail(
  ids: readonly string[],
  isEmpty: (id: string) => boolean,
): boolean {
  const count = ids.length;
  return count >= 2 && isEmpty(ids[count - 1]) && isEmpty(ids[count - 2]);
}

/**
 * Throws if the children of a parent end with two empty nodes after a change,
 * but did not before. An existing violation does not block other changes.
 */
export function checkEmptyTail(
  before: readonly string[],
  after: readonly string[],
  isEmpty: (id: string) => boolean,
): void {
  if (hasEmptyTail(after, isEmpty) && !hasEmptyTail(before, isEmpty)) {
    throw new OutlineError(
      "emptyTail",
      "The last two children of a node cannot both be empty",
    );
  }
}
