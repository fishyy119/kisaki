PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_animes` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`name` text DEFAULT 'unknown anime' NOT NULL,
	`original_name` text,
	`sort_name` text,
	`cover_file` text,
	`backdrop_file` text,
	`logo_file` text,
	`score` integer,
	`is_favorite` integer DEFAULT false NOT NULL,
	`release_date` text,
	`description` text,
	`external_sites` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`format` text DEFAULT 'tv' NOT NULL,
	`total_episodes` integer,
	`episode_file_number_offset` integer DEFAULT 0 NOT NULL,
	`last_active_at` integer,
	`total_duration` integer DEFAULT 0 NOT NULL,
	`anime_dir_path` text,
	`is_nsfw` integer DEFAULT false NOT NULL,
	`description_inline_files` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_animes`("id", "created_at", "updated_at", "name", "original_name", "sort_name", "cover_file", "backdrop_file", "logo_file", "score", "is_favorite", "release_date", "description", "external_sites", "status", "format", "total_episodes", "episode_file_number_offset", "last_active_at", "total_duration", "anime_dir_path", "is_nsfw", "description_inline_files") SELECT "id", "created_at", "updated_at", "name", "original_name", "sort_name", "cover_file", "backdrop_file", "logo_file", "score", "is_favorite", "release_date", "description", "external_sites", "status", "format", "total_episodes", "episode_file_number_offset", "last_active_at", "total_duration", "anime_dir_path", "is_nsfw", "description_inline_files" FROM `animes`;--> statement-breakpoint
DROP TABLE `animes`;--> statement-breakpoint
ALTER TABLE `__new_animes` RENAME TO `animes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_animes_status` ON `animes` (`status`);--> statement-breakpoint
CREATE INDEX `idx_animes_format` ON `animes` (`format`);--> statement-breakpoint
CREATE INDEX `idx_animes_is_favorite` ON `animes` (`is_favorite`);--> statement-breakpoint
CREATE INDEX `idx_animes_is_nsfw` ON `animes` (`is_nsfw`);--> statement-breakpoint
CREATE INDEX `idx_animes_last_active_at` ON `animes` (`last_active_at`);--> statement-breakpoint
CREATE INDEX `idx_animes_created_at` ON `animes` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_animes_name` ON `animes` (`name`);--> statement-breakpoint
CREATE INDEX `idx_animes_score` ON `animes` (`score`);--> statement-breakpoint
UPDATE `animes` SET `status` = CASE `status`
	WHEN 'notStarted' THEN 'planned'
	WHEN 'inProgress' THEN 'watching'
	WHEN 'partial' THEN 'watching'
	WHEN 'multiple' THEN 'completed'
	WHEN 'shelved' THEN 'onHold'
	ELSE `status`
END;--> statement-breakpoint
UPDATE `animes` SET `status` = 'planned' WHERE `status` NOT IN ('planned', 'watching', 'completed', 'onHold', 'dropped');