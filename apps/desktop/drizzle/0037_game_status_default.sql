PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_games` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`name` text DEFAULT 'unknown game' NOT NULL,
	`original_name` text,
	`sort_name` text,
	`aliases` text DEFAULT '[]' NOT NULL,
	`cover_file` text,
	`backdrop_file` text,
	`logo_file` text,
	`icon_file` text,
	`score` integer,
	`is_favorite` integer DEFAULT false NOT NULL,
	`release_date` text,
	`description` text,
	`external_sites` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`last_active_at` integer,
	`total_duration` integer DEFAULT 0 NOT NULL,
	`save_path` text,
	`save_backups` text,
	`max_save_backups` integer DEFAULT 5 NOT NULL,
	`launcher_mode` text DEFAULT 'file' NOT NULL,
	`launcher_path` text,
	`monitor_mode` text DEFAULT 'folder' NOT NULL,
	`monitor_path` text,
	`dir_path` text,
	`is_nsfw` integer DEFAULT false NOT NULL,
	`description_inline_files` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_games`("id", "created_at", "updated_at", "name", "original_name", "sort_name", "aliases", "cover_file", "backdrop_file", "logo_file", "icon_file", "score", "is_favorite", "release_date", "description", "external_sites", "status", "last_active_at", "total_duration", "save_path", "save_backups", "max_save_backups", "launcher_mode", "launcher_path", "monitor_mode", "monitor_path", "dir_path", "is_nsfw", "description_inline_files") SELECT "id", "created_at", "updated_at", "name", "original_name", "sort_name", "aliases", "cover_file", "backdrop_file", "logo_file", "icon_file", "score", "is_favorite", "release_date", "description", "external_sites", "status", "last_active_at", "total_duration", "save_path", "save_backups", "max_save_backups", "launcher_mode", "launcher_path", "monitor_mode", "monitor_path", "dir_path", "is_nsfw", "description_inline_files" FROM `games`;--> statement-breakpoint
DROP TABLE `games`;--> statement-breakpoint
ALTER TABLE `__new_games` RENAME TO `games`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_games_status` ON `games` (`status`);--> statement-breakpoint
CREATE INDEX `idx_games_is_favorite` ON `games` (`is_favorite`);--> statement-breakpoint
CREATE INDEX `idx_games_is_nsfw` ON `games` (`is_nsfw`);--> statement-breakpoint
CREATE INDEX `idx_games_last_active_at` ON `games` (`last_active_at`);--> statement-breakpoint
CREATE INDEX `idx_games_created_at` ON `games` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_games_name` ON `games` (`name`);--> statement-breakpoint
CREATE INDEX `idx_games_score` ON `games` (`score`);