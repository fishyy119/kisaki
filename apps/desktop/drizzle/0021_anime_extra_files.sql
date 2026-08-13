CREATE TABLE `anime_extra_files` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`extra_id` text NOT NULL,
	`path` text NOT NULL,
	`file_size` integer,
	`file_mtime` integer,
	`container` text,
	`video_codec` text,
	`bit_depth` integer,
	`width` integer,
	`height` integer,
	`duration_ms` integer,
	`audio_tracks` text DEFAULT '[]' NOT NULL,
	`subtitle_tracks` text DEFAULT '[]' NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`is_manual` integer DEFAULT false NOT NULL,
	`note` text,
	FOREIGN KEY (`extra_id`) REFERENCES `anime_extras`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `anime_extra_files_path_unique` ON `anime_extra_files` (`path`);--> statement-breakpoint
CREATE INDEX `idx_anime_extra_files_extra_id` ON `anime_extra_files` (`extra_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_anime_extra_files_primary` ON `anime_extra_files` (`extra_id`) WHERE is_primary = 1;--> statement-breakpoint
INSERT INTO `anime_extra_files` (`id`, `created_at`, `updated_at`, `extra_id`, `path`, `duration_ms`, `is_primary`, `is_manual`)
SELECT lower(hex(randomblob(16))), `created_at`, `updated_at`, `id`, `path`, `duration_ms`, 1, `is_manual`
FROM `anime_extras`;--> statement-breakpoint
DROP INDEX `anime_extras_path_unique`;--> statement-breakpoint
ALTER TABLE `anime_extras` DROP COLUMN `path`;--> statement-breakpoint
ALTER TABLE `anime_extras` DROP COLUMN `duration_ms`;--> statement-breakpoint
ALTER TABLE `anime_extras` RENAME COLUMN `kind` TO `type`;--> statement-breakpoint
UPDATE `anime_episode_files` SET `is_primary` = 0
WHERE `is_primary` = 1 AND `id` IN (
	SELECT f.`id` FROM `anime_episode_files` f
	WHERE f.`is_primary` = 1 AND EXISTS (
		SELECT 1 FROM `anime_episode_files` k
		WHERE k.`episode_id` = f.`episode_id` AND k.`is_primary` = 1
			AND (k.`created_at` < f.`created_at` OR (k.`created_at` = f.`created_at` AND k.`id` < f.`id`))
	)
);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_anime_episode_files_primary` ON `anime_episode_files` (`episode_id`) WHERE is_primary = 1;--> statement-breakpoint
UPDATE `anime_episodes` SET `episode_number` = NULL
WHERE `episode_number` IS NOT NULL AND `id` IN (
	SELECT e.`id` FROM `anime_episodes` e
	WHERE e.`episode_number` IS NOT NULL AND EXISTS (
		SELECT 1 FROM `anime_episodes` k
		WHERE k.`anime_id` = e.`anime_id` AND k.`type` = e.`type`
			AND k.`episode_number` = e.`episode_number`
			AND (k.`created_at` < e.`created_at` OR (k.`created_at` = e.`created_at` AND k.`id` < e.`id`))
	)
);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_anime_episodes_number` ON `anime_episodes` (`anime_id`,`type`,`episode_number`) WHERE episode_number IS NOT NULL;--> statement-breakpoint
UPDATE `anime_person_links` SET `role` = 'seriesComposition' WHERE `role` = 'series';