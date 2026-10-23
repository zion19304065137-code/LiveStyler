CREATE TABLE `ai_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`state` text NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL,
	`message` text NOT NULL,
	`result_key` text
);
--> statement-breakpoint
CREATE TABLE `channel_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`channel` text NOT NULL,
	`created` text NOT NULL,
	`before_image` text NOT NULL,
	`after_image` text NOT NULL,
	`state` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cloud_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`updated` text NOT NULL,
	`object_key` text NOT NULL
);
