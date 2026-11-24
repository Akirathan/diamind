/** The local roots that were visited, oldest first. */
export interface NavigationHistory {
  readonly entries: readonly string[];
  /** The entry that is shown now. */
  readonly index: number;
}

/** The keys of the `app_state` table and the types of their values. */
export interface AppState {
  zoomedNodeId: string;
  navigationHistory: NavigationHistory;
}

export type AppStateKey = keyof AppState;

/** A key that was never saved is missing. */
export type AppStateValues = { readonly [K in AppStateKey]?: AppState[K] };
