import type { NavigationHistory } from "@/shared/app-state";

/** The oldest entries above this limit are dropped. */
export const MAX_ENTRIES = 100;

export type Direction = "back" | "forward";

export function newHistory(id: string): NavigationHistory {
  return { entries: [id], index: 0 };
}

/** Adds an entry after the current one and drops the entries that were there. */
export function visit(
  { entries, index }: NavigationHistory,
  id: string,
): NavigationHistory {
  const next = [...entries.slice(0, index + 1), id].slice(-MAX_ENTRIES);
  return { entries: next, index: next.length - 1 };
}

export function replaceCurrent(
  { entries, index }: NavigationHistory,
  id: string,
): NavigationHistory {
  return { entries: entries.with(index, id), index };
}

/** Skips deleted nodes and repeated entries of the current node. `null` if there is no entry left. */
export function step(
  { entries, index }: NavigationHistory,
  direction: Direction,
  exists: (id: string) => boolean,
): NavigationHistory | null {
  const delta = direction === "back" ? -1 : 1;
  for (let i = index + delta; i >= 0 && i < entries.length; i += delta) {
    if (entries[i] !== entries[index] && exists(entries[i])) {
      return { entries, index: i };
    }
  }
  return null;
}

/** The saved history without unknown nodes, with `currentId` as the current entry. */
export function restoreHistory(
  saved: unknown,
  currentId: string,
  exists: (id: string) => boolean,
): NavigationHistory {
  if (!isHistory(saved)) {
    return newHistory(currentId);
  }
  const before = saved.entries.slice(0, saved.index).filter(exists);
  const after = saved.entries.slice(saved.index + 1).filter(exists);
  return { entries: [...before, currentId, ...after], index: before.length };
}

function isHistory(value: unknown): value is NavigationHistory {
  const history = value as NavigationHistory | null | undefined;
  return (
    Array.isArray(history?.entries) &&
    history.entries.every((id) => typeof id === "string") &&
    Number.isInteger(history.index) &&
    history.index >= 0 &&
    history.index < history.entries.length
  );
}
