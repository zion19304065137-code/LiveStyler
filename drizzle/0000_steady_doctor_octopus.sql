CREATE TABLE `polyv_connections` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`verified_channel` text NOT NULL,
	`updated_at` text NOT NULL
);
