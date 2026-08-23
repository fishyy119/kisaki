ALTER TABLE `scanners` ADD `watch_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `scanner_start_at_open`;