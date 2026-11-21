interface Sortable {
  readonly sortKey: string;
  readonly id: string;
}

/** Fractional index keys sort by plain code unit order, not by locale. */
export function compareSortKeys(a: Sortable, b: Sortable): number {
  if (a.sortKey !== b.sortKey) {
    return a.sortKey < b.sortKey ? -1 : 1;
  }
  if (a.id === b.id) {
    return 0;
  }
  return a.id < b.id ? -1 : 1;
}
