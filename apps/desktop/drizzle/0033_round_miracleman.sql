CREATE TABLE `comic_bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`chapter_id` text NOT NULL,
	`page_index` integer NOT NULL,
	`note` text,
	FOREIGN KEY (`chapter_id`) REFERENCES `comic_chapters`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_comic_bookmarks_chapter_id` ON `comic_bookmarks` (`chapter_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_comic_bookmarks_page` ON `comic_bookmarks` (`chapter_id`,`page_index`);--> statement-breakpoint
CREATE TABLE `novel_bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`volume_id` text NOT NULL,
	`locator` text NOT NULL,
	`progress` real,
	`excerpt` text,
	`note` text,
	FOREIGN KEY (`volume_id`) REFERENCES `novel_volumes`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_novel_bookmarks_volume_id` ON `novel_bookmarks` (`volume_id`);--> statement-breakpoint
CREATE TABLE `novel_highlights` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`volume_id` text NOT NULL,
	`locator` text NOT NULL,
	`progress` real,
	`excerpt` text NOT NULL,
	`color` text DEFAULT 'yellow' NOT NULL,
	`note` text,
	FOREIGN KEY (`volume_id`) REFERENCES `novel_volumes`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_novel_highlights_volume_id` ON `novel_highlights` (`volume_id`);