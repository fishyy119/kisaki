PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_showcase_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`name` text NOT NULL,
	`entity_type` text DEFAULT 'game' NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`is_visible` integer DEFAULT true NOT NULL,
	`layout` text DEFAULT 'horizontal' NOT NULL,
	`item_size` text DEFAULT 'md' NOT NULL,
	`open_mode` text DEFAULT 'page' NOT NULL,
	`limit` integer,
	`filter` text DEFAULT '{"match":"all","conditions":[]}' NOT NULL,
	`sort_field` text DEFAULT 'name' NOT NULL,
	`sort_direction` text DEFAULT 'asc' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_showcase_sections`("id", "created_at", "updated_at", "name", "entity_type", "order", "is_visible", "layout", "item_size", "open_mode", "limit", "filter", "sort_field", "sort_direction") SELECT "id", "created_at", "updated_at", "name", "entity_type", "order", "is_visible", "layout", "item_size", "open_mode", "limit", "filter", "sort_field", "sort_direction" FROM `showcase_sections`;--> statement-breakpoint
DROP TABLE `showcase_sections`;--> statement-breakpoint
ALTER TABLE `__new_showcase_sections` RENAME TO `showcase_sections`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_showcase_sections_order` ON `showcase_sections` (`order`);--> statement-breakpoint
ALTER TABLE `tags` ADD `normalized_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_tags_normalized_name` ON `tags` (`normalized_name`);