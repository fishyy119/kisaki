ALTER TABLE `settings` ADD `updater_auto_check` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `updater_allow_prerelease` integer DEFAULT false NOT NULL;