ALTER TABLE `games` RENAME COLUMN `game_dir_path` TO `dir_path`;--> statement-breakpoint
ALTER TABLE `animes` RENAME COLUMN `anime_dir_path` TO `dir_path`;--> statement-breakpoint
ALTER TABLE `comics` RENAME COLUMN `comic_dir_path` TO `dir_path`;--> statement-breakpoint
ALTER TABLE `novels` RENAME COLUMN `novel_dir_path` TO `dir_path`;--> statement-breakpoint
ALTER TABLE `scraper_profiles` RENAME COLUMN `media_type` TO `entity_type`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_scraper_profiles_media_type`;--> statement-breakpoint
CREATE INDEX `idx_scraper_profiles_entity_type` ON `scraper_profiles` (`entity_type`);
