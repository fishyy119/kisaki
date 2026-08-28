ALTER TABLE `scraper_profiles` RENAME COLUMN `source_preset_id` TO `recipe_id`;--> statement-breakpoint
ALTER TABLE `scraper_profiles` ADD `dismissed_recipe_fingerprint` text;--> statement-breakpoint
UPDATE `scraper_profiles` SET `recipe_id` = NULL;
