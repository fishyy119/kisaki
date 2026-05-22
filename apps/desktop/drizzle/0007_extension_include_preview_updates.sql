DROP INDEX `idx_extension_installations_channel`;--> statement-breakpoint
ALTER TABLE `extension_installations` ADD `include_preview_updates` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `extension_installations` DROP COLUMN `channel`;
