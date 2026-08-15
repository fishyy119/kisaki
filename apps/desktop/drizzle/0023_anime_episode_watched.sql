DROP INDEX `idx_anime_episodes_watched_at`;--> statement-breakpoint
ALTER TABLE `anime_episodes` ADD `watched` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `anime_episodes` SET `watched` = true WHERE `watched_at` IS NOT NULL;
