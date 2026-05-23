ALTER TABLE `background_tasks` ADD `triggers` text DEFAULT '{"onStartup":false}' NOT NULL;--> statement-breakpoint
ALTER TABLE `background_tasks` DROP COLUMN `schedule`;
