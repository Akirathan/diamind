import type { AppState, AppStateKey, AppStateValues } from "@/shared/app-state";

export type AppStateListener = (changed: AppStateValues) => void;

/**
 * The rows of the `app_state` table in memory. A value can come from another
 * version of the app, so check it before use.
 */
export class AppStateStore {
  private values: AppStateValues;
  private readonly listeners = new Set<AppStateListener>();

  constructor(values: AppStateValues) {
    this.values = { ...values };
  }

  get<Key extends AppStateKey>(key: Key): AppStateValues[Key] {
    return this.values[key];
  }

  set<Key extends AppStateKey>(key: Key, value: AppState[Key]): void {
    if (this.values[key] === value) {
      return;
    }
    const changed: AppStateValues = { [key]: value };
    this.values = { ...this.values, ...changed };
    for (const listener of this.listeners) {
      listener(changed);
    }
  }

  readonly subscribe = (listener: AppStateListener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}
