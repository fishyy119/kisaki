PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_settings` (
	`id` integer PRIMARY KEY DEFAULT 0 NOT NULL,
	`ui_locale` text,
	`ui_scale` integer DEFAULT 100 NOT NULL,
	`main_window_close_action` text DEFAULT 'exit' NOT NULL,
	`scanner_ignored_names` text DEFAULT '[]' NOT NULL,
	`scanner_parallel_count` integer DEFAULT 1 NOT NULL,
	`scanner_ingest_mode` text DEFAULT 'prefer-scraper' NOT NULL,
	`updater_auto_check` integer DEFAULT true NOT NULL,
	`updater_allow_prerelease` integer DEFAULT false NOT NULL,
	CONSTRAINT "single_row_check" CHECK("__new_settings"."id" = 0),
	CONSTRAINT "ui_scale_values_check" CHECK("__new_settings"."ui_scale" in (70, 80, 90, 100, 110, 120, 130)),
	CONSTRAINT "scanner_parallel_count_range_check" CHECK("__new_settings"."scanner_parallel_count" >= 1 and "__new_settings"."scanner_parallel_count" <= 16)
);
--> statement-breakpoint
INSERT INTO `__new_settings`("id", "ui_locale", "ui_scale", "main_window_close_action", "scanner_ignored_names", "scanner_parallel_count", "scanner_ingest_mode", "updater_auto_check", "updater_allow_prerelease") SELECT "id", "ui_locale", CASE WHEN "ui_scale" IN (70, 80, 90, 100, 110, 120, 130) THEN "ui_scale" WHEN "ui_scale" > 130 THEN 130 ELSE 100 END, "main_window_close_action", "scanner_ignored_names", "scanner_parallel_count", "scanner_ingest_mode", "updater_auto_check", "updater_allow_prerelease" FROM `settings`;--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
ALTER TABLE `__new_settings` RENAME TO `settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;