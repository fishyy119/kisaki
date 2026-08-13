CREATE TABLE `anime_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`anime_id` text NOT NULL,
	`name` text NOT NULL,
	`content` text,
	`content_inline_files` text DEFAULT '[]' NOT NULL,
	`cover_file` text,
	`order_in_anime` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`anime_id`) REFERENCES `animes`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_anime_notes_anime_id` ON `anime_notes` (`anime_id`);--> statement-breakpoint
CREATE INDEX `idx_anime_notes_anime_id_order` ON `anime_notes` (`anime_id`,`order_in_anime`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_anime_notes_anime_id_name` ON `anime_notes` (`anime_id`,`name`);