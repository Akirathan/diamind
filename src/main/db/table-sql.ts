import { getTableColumns, getTableName, sql, type SQL } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

/** A query that returns each row as JSON text. JSON columns are left out when NULL. */
export function selectRowsAsJson(table: SQLiteTable): string {
  const fields: string[] = [];
  const jsonFields: string[] = [];
  for (const [field, column] of Object.entries(getTableColumns(table))) {
    const name = `"${column.name}"`;
    if (column.dataType === "json") {
      // Not `json()`: it fails for values nested deeper than 1000 levels.
      jsonFields.push(`coalesce('"${field}":' || ${name} || ',', '')`);
    } else if (column.dataType === "boolean") {
      fields.push(`'${field}', json(iif(${name}, 'true', 'false'))`);
    } else {
      fields.push(`'${field}', ${name}`);
    }
  }
  const parts = [
    "'{'",
    ...jsonFields,
    `substr(json_object(${fields.join(", ")}), 2)`,
  ];
  return `SELECT ${parts.join(" || ")} FROM "${getTableName(table)}"`;
}

/** `values` and `set` of a prepared upsert, with one placeholder per field. */
export function upsertPlaceholders<Table extends SQLiteTable>(table: Table) {
  const values: Record<string, SQL> = {};
  const set: Record<string, SQL> = {};
  for (const [field, column] of Object.entries(getTableColumns(table))) {
    const param = sql`${sql.param(sql.placeholder(field), column)}`;
    // drizzle encodes a null placeholder of a JSON column as the text 'null'.
    values[field] =
      column.dataType === "json" ? sql`nullif(${param}, 'null')` : param;
    set[field] = sql`excluded.${sql.identifier(column.name)}`;
  }
  return { values: values as { [F in keyof Table["$inferInsert"]]: SQL }, set };
}
