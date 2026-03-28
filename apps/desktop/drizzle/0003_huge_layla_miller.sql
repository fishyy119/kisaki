PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_settings` (
	`id` integer PRIMARY KEY DEFAULT 0 NOT NULL,
	`locale` text,
	`main_window_close_action` text DEFAULT 'exit' NOT NULL,
	`scanner_ignored_names` text DEFAULT '[]' NOT NULL,
	`scanner_use_phash` integer DEFAULT false NOT NULL,
	`scanner_start_at_open` integer DEFAULT false NOT NULL,
	`scanner_parallel_count` integer DEFAULT 1 NOT NULL,
	`scanner_ingest_mode` text DEFAULT 'prefer-scraper' NOT NULL,
	`updater_auto_check` integer DEFAULT true NOT NULL,
	`updater_allow_prerelease` integer DEFAULT false NOT NULL,
	CONSTRAINT "single_row_check" CHECK("__new_settings"."id" = 0),
	CONSTRAINT "scanner_parallel_count_range_check" CHECK("__new_settings"."scanner_parallel_count" >= 1 and "__new_settings"."scanner_parallel_count" <= 16)
);
--> statement-breakpoint
INSERT INTO `__new_settings`("id", "locale", "main_window_close_action", "scanner_ignored_names", "scanner_use_phash", "scanner_start_at_open", "scanner_parallel_count", "scanner_ingest_mode", "updater_auto_check", "updater_allow_prerelease") SELECT "id", "locale", "main_window_close_action", "scanner_ignored_names", "scanner_use_phash", "scanner_start_at_open", 1, "scanner_ingest_mode", "updater_auto_check", "updater_allow_prerelease" FROM `settings`;--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
ALTER TABLE `__new_settings` RENAME TO `settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
