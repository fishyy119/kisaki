CREATE TABLE `background_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_extension_id` text,
	`created_by` text DEFAULT 'user' NOT NULL,
	`command_id` text NOT NULL,
	`args` text DEFAULT '{}' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`schedule` text DEFAULT '{"type":"manual"}' NOT NULL,
	`failure_policy` text DEFAULT '{"type":"none"}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_run_at` integer,
	`next_run_at` integer,
	`history` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_background_tasks_owner_extension_id` ON `background_tasks` (`owner_extension_id`);--> statement-breakpoint
CREATE INDEX `idx_background_tasks_command_id` ON `background_tasks` (`command_id`);--> statement-breakpoint
CREATE INDEX `idx_background_tasks_enabled_next_run_at` ON `background_tasks` (`enabled`,`next_run_at`);