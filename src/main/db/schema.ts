import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import {
  NODE_FORMATS,
  NODE_TYPES,
  type NodeAttributes,
} from "@/shared/outline/node";

export const nodes = sqliteTable("nodes", {
  id: text("id").primaryKey(),
  parentId: text("parent_id"),
  sortKey: text("sort_key").notNull(),
  type: text("type", { enum: NODE_TYPES }).notNull(),
  format: text("format", { enum: NODE_FORMATS }).notNull(),
  text: text("text").notNull().default(""),
  note: text("note").notNull().default(""),
  completedAt: integer("completed_at"),
  attributes: text("attributes", { mode: "json" }).$type<NodeAttributes>(),
  attachmentId: text("attachment_id"),
  createdAt: integer("created_at").notNull(),
  modifiedAt: integer("modified_at").notNull(),
});

export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  path: text("path").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  sha256: text("sha256").notNull(),
});

export const nodeUiState = sqliteTable("node_ui_state", {
  nodeId: text("node_id").primaryKey(),
  collapsed: integer("collapsed", { mode: "boolean" }).notNull().default(false),
  scrollTop: integer("scroll_top"),
});

export const appState = sqliteTable("app_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type NodeRow = typeof nodes.$inferSelect;
export type NodeUiStateRow = typeof nodeUiState.$inferSelect;
