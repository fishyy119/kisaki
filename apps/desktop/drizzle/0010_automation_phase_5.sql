DROP TABLE IF EXISTS `background_tasks`;
--> statement-breakpoint
CREATE TABLE `automations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner` text DEFAULT '{"type":"app"}' NOT NULL,
	`owner_extension_id` text,
	`command_id` text NOT NULL,
	`args` text DEFAULT '{}' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`triggers` text DEFAULT '{"onStartup":false}' NOT NULL,
	`failure_policy` text DEFAULT '{"type":"none"}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_run_at` integer,
	`next_run_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_automations_owner_extension_id` ON `automations` (`owner_extension_id`);
--> statement-breakpoint
CREATE INDEX `idx_automations_command_id` ON `automations` (`command_id`);
--> statement-breakpoint
CREATE INDEX `idx_automations_enabled_next_run_at` ON `automations` (`enabled`,`next_run_at`);
--> statement-breakpoint
CREATE TABLE `automation_run_history` (
	`id` text PRIMARY KEY NOT NULL,
	`automation_id` text NOT NULL,
	`automation_name_snapshot` text NOT NULL,
	`owner` text NOT NULL,
	`owner_extension_id` text,
	`trigger` text NOT NULL,
	`attempt` integer NOT NULL,
	`command_id` text NOT NULL,
	`command_title_snapshot` text,
	`started_at` integer NOT NULL,
	`finished_at` integer NOT NULL,
	`invocation_status` text NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `idx_automation_run_history_automation_finished_at` ON `automation_run_history` (`automation_id`,`finished_at`);
--> statement-breakpoint
CREATE INDEX `idx_automation_run_history_command_finished_at` ON `automation_run_history` (`command_id`,`finished_at`);
--> statement-breakpoint
CREATE INDEX `idx_automation_run_history_owner_extension_finished_at` ON `automation_run_history` (`owner_extension_id`,`finished_at`);
--> statement-breakpoint
CREATE INDEX `idx_automation_run_history_finished_at` ON `automation_run_history` (`finished_at`);
