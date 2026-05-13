CREATE TABLE `extension_installations` (
	`id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`version` text NOT NULL,
	`source` text NOT NULL,
	`install_reason` text DEFAULT 'manual' NOT NULL,
	`update_policy` text DEFAULT 'manual' NOT NULL,
	`pinned_version` text,
	`channel` text DEFAULT 'stable' NOT NULL,
	`installed_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_extension_installations_enabled` ON `extension_installations` (`enabled`);--> statement-breakpoint
CREATE INDEX `idx_extension_installations_update_policy` ON `extension_installations` (`update_policy`);--> statement-breakpoint
CREATE INDEX `idx_extension_installations_channel` ON `extension_installations` (`channel`);--> statement-breakpoint
CREATE TABLE `extension_repositories` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`url` text NOT NULL,
	`name` text NOT NULL,
	`state` text DEFAULT 'enabled' NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`manifest_snapshot` text,
	`last_refresh_at` integer,
	`last_success_at` integer,
	`last_error` text,
	`manifest_digest` text,
	`etag` text,
	`last_modified` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `extension_repositories_url_unique` ON `extension_repositories` (`url`);--> statement-breakpoint
CREATE INDEX `idx_extension_repositories_state_priority` ON `extension_repositories` (`state`,`priority`);--> statement-breakpoint
CREATE TABLE `extension_signer_trusts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`extension_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`algorithm` text DEFAULT 'ed25519' NOT NULL,
	`public_key` text NOT NULL,
	`label` text,
	`trusted_from_repository_id` text,
	`trusted_from_repository_url` text,
	`trusted_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_extension_signer_trusts_extension_id` ON `extension_signer_trusts` (`extension_id`);--> statement-breakpoint
CREATE INDEX `idx_extension_signer_trusts_fingerprint` ON `extension_signer_trusts` (`fingerprint`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_extension_signer_trust_scope` ON `extension_signer_trusts` (`extension_id`,`fingerprint`);
