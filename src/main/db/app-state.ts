import type { AppStateValues } from "@/shared/app-state";
import type { Db } from "@/main/db/database";
import { appState } from "@/main/db/schema";

/** A value that is not valid JSON is left out. */
export function loadAppState(db: Db): AppStateValues {
  const values: Record<string, unknown> = {};
  for (const { key, value } of db.select().from(appState).all()) {
    try {
      values[key] = JSON.parse(value);
    } catch (error) {
      console.error(`The app state ${key} is not valid JSON`, error);
    }
  }
  return values;
}

export function writeAppState(
  db: Pick<Db, "insert">,
  values: AppStateValues,
): void {
  for (const [key, value] of Object.entries(values)) {
    const row = { key, value: JSON.stringify(value) };
    db.insert(appState)
      .values(row)
      .onConflictDoUpdate({ target: appState.key, set: { value: row.value } })
      .run();
  }
}
