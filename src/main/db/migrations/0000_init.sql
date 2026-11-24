CREATE TABLE `app_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `node_ui_state` (
	`node_id` text PRIMARY KEY NOT NULL,
	`collapsed` integer DEFAULT false NOT NULL,
	`scroll_top` integer
);
--> statement-breakpoint
CREATE TABLE `nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`sort_key` text NOT NULL,
	`type` text NOT NULL,
	`format` text NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`completed_at` integer,
	`attributes` text,
	`attachment_id` text,
	`created_at` integer NOT NULL,
	`modified_at` integer NOT NULL
);
