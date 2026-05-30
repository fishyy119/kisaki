CREATE TABLE `task_run_history` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`operation` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text NOT NULL,
	`owner` text NOT NULL,
	`owner_extension_id` text,
	`initiator` text NOT NULL,
	`subject` text,
	`controls` text NOT NULL,
	`progress` text,
	`result` text,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`updated_at` integer NOT NULL,
	`finished_at` integer,
	CONSTRAINT "task_run_history_final_status_check" CHECK("task_run_history"."status" in ('completed', 'failed', 'cancelled'))
);
--> statement-breakpoint
CREATE INDEX `idx_task_run_history_owner_extension_finished_at` ON `task_run_history` (`owner_extension_id`,`finished_at`);--> statement-breakpoint
CREATE INDEX `idx_task_run_history_category_finished_at` ON `task_run_history` (`category`,`finished_at`);--> statement-breakpoint
CREATE INDEX `idx_task_run_history_operation_finished_at` ON `task_run_history` (`operation`,`finished_at`);--> statement-breakpoint
CREATE INDEX `idx_task_run_history_finished_at` ON `task_run_history` (`finished_at`);