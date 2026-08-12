DROP TABLE `anime_relations`;
--> statement-breakpoint
CREATE TABLE `media_relations` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`from_type` text NOT NULL,
	`from_id` text NOT NULL,
	`to_type` text NOT NULL,
	`to_id` text NOT NULL,
	`type` text DEFAULT 'other' NOT NULL,
	`note` text,
	`order_in_from` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_relations_from_type_from_id_to_type_to_id_type_unique` ON `media_relations` (`from_type`,`from_id`,`to_type`,`to_id`,`type`);
--> statement-breakpoint
CREATE INDEX `idx_media_relations_from` ON `media_relations` (`from_type`,`from_id`);
--> statement-breakpoint
CREATE INDEX `idx_media_relations_to` ON `media_relations` (`to_type`,`to_id`);
