PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_scanners` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`type` text NOT NULL,
	`scraper_profile_id` text,
	`target_collection_id` text,
	`watch_enabled` integer DEFAULT true NOT NULL,
	`entity_depth` integer DEFAULT 0 NOT NULL,
	`name_extraction_rules` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`scraper_profile_id`) REFERENCES `scraper_profiles`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`target_collection_id`) REFERENCES `collections`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_scanners`("id", "created_at", "updated_at", "name", "path", "type", "scraper_profile_id", "target_collection_id", "watch_enabled", "entity_depth", "name_extraction_rules") SELECT "id", "created_at", "updated_at", "name", "path", "type", "scraper_profile_id", "target_collection_id", "watch_enabled", "entity_depth", "name_extraction_rules" FROM `scanners`;--> statement-breakpoint
DROP TABLE `scanners`;--> statement-breakpoint
ALTER TABLE `__new_scanners` RENAME TO `scanners`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_scanners_type` ON `scanners` (`type`);--> statement-breakpoint
CREATE INDEX `idx_scanners_scraper_profile_id` ON `scanners` (`scraper_profile_id`);