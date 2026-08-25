CREATE TABLE `comic_chapter_files` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`chapter_id` text NOT NULL,
	`path` text NOT NULL,
	`file_size` integer,
	`file_mtime` integer,
	`container` text,
	`page_count` integer,
	`is_primary` integer DEFAULT false NOT NULL,
	`is_manual` integer DEFAULT false NOT NULL,
	`note` text,
	FOREIGN KEY (`chapter_id`) REFERENCES `comic_chapters`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `comic_chapter_files_path_unique` ON `comic_chapter_files` (`path`);--> statement-breakpoint
CREATE INDEX `idx_comic_chapter_files_chapter_id` ON `comic_chapter_files` (`chapter_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_comic_chapter_files_primary` ON `comic_chapter_files` (`chapter_id`) WHERE is_primary = 1;--> statement-breakpoint
CREATE TABLE `comic_chapters` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`comic_id` text NOT NULL,
	`volume_number` real,
	`chapter_number` real,
	`name` text,
	`original_name` text,
	`release_date` text,
	`description` text,
	`cover_file` text,
	`read` integer DEFAULT false NOT NULL,
	`read_at` integer,
	`read_count` integer DEFAULT 0 NOT NULL,
	`resume_page` integer,
	`order_in_comic` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`comic_id`) REFERENCES `comics`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_comic_chapters_comic_id` ON `comic_chapters` (`comic_id`);--> statement-breakpoint
CREATE INDEX `idx_comic_chapters_comic_id_order` ON `comic_chapters` (`comic_id`,`order_in_comic`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_comic_chapters_chapter_number` ON `comic_chapters` (`comic_id`,`chapter_number`) WHERE chapter_number IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `unique_comic_chapters_volume_number` ON `comic_chapters` (`comic_id`,`volume_number`) WHERE chapter_number IS NULL AND volume_number IS NOT NULL;--> statement-breakpoint
CREATE TABLE `comic_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`comic_id` text NOT NULL,
	`chapter_id` text,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	FOREIGN KEY (`comic_id`) REFERENCES `comics`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `comic_chapters`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_comic_sessions_comic_id` ON `comic_sessions` (`comic_id`);--> statement-breakpoint
CREATE INDEX `idx_comic_sessions_chapter_id` ON `comic_sessions` (`chapter_id`);--> statement-breakpoint
CREATE INDEX `idx_comic_sessions_started_at` ON `comic_sessions` (`started_at`);--> statement-breakpoint
CREATE TABLE `comic_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`comic_id` text NOT NULL,
	`name` text NOT NULL,
	`content` text,
	`content_inline_files` text DEFAULT '[]' NOT NULL,
	`cover_file` text,
	`order_in_comic` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`comic_id`) REFERENCES `comics`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_comic_notes_comic_id` ON `comic_notes` (`comic_id`);--> statement-breakpoint
CREATE INDEX `idx_comic_notes_comic_id_order` ON `comic_notes` (`comic_id`,`order_in_comic`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_comic_notes_comic_id_name` ON `comic_notes` (`comic_id`,`name`);--> statement-breakpoint
CREATE TABLE `comics` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`name` text DEFAULT 'unknown comic' NOT NULL,
	`original_name` text,
	`sort_name` text,
	`aliases` text DEFAULT '[]' NOT NULL,
	`cover_file` text,
	`backdrop_file` text,
	`logo_file` text,
	`score` integer,
	`is_favorite` integer DEFAULT false NOT NULL,
	`release_date` text,
	`description` text,
	`external_sites` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`format` text DEFAULT 'manga' NOT NULL,
	`reading_direction` text,
	`total_volumes` integer,
	`total_chapters` integer,
	`last_active_at` integer,
	`total_duration` integer DEFAULT 0 NOT NULL,
	`comic_dir_path` text,
	`is_nsfw` integer DEFAULT false NOT NULL,
	`description_inline_files` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_comics_status` ON `comics` (`status`);--> statement-breakpoint
CREATE INDEX `idx_comics_format` ON `comics` (`format`);--> statement-breakpoint
CREATE INDEX `idx_comics_is_favorite` ON `comics` (`is_favorite`);--> statement-breakpoint
CREATE INDEX `idx_comics_is_nsfw` ON `comics` (`is_nsfw`);--> statement-breakpoint
CREATE INDEX `idx_comics_last_active_at` ON `comics` (`last_active_at`);--> statement-breakpoint
CREATE INDEX `idx_comics_created_at` ON `comics` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_comics_name` ON `comics` (`name`);--> statement-breakpoint
CREATE INDEX `idx_comics_score` ON `comics` (`score`);--> statement-breakpoint
CREATE TABLE `novel_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`novel_id` text NOT NULL,
	`name` text NOT NULL,
	`content` text,
	`content_inline_files` text DEFAULT '[]' NOT NULL,
	`cover_file` text,
	`order_in_novel` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`novel_id`) REFERENCES `novels`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_novel_notes_novel_id` ON `novel_notes` (`novel_id`);--> statement-breakpoint
CREATE INDEX `idx_novel_notes_novel_id_order` ON `novel_notes` (`novel_id`,`order_in_novel`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_novel_notes_novel_id_name` ON `novel_notes` (`novel_id`,`name`);--> statement-breakpoint
CREATE TABLE `novels` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`name` text DEFAULT 'unknown novel' NOT NULL,
	`original_name` text,
	`sort_name` text,
	`aliases` text DEFAULT '[]' NOT NULL,
	`cover_file` text,
	`backdrop_file` text,
	`logo_file` text,
	`score` integer,
	`is_favorite` integer DEFAULT false NOT NULL,
	`release_date` text,
	`description` text,
	`external_sites` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`format` text DEFAULT 'lightNovel' NOT NULL,
	`total_volumes` integer,
	`last_active_at` integer,
	`total_duration` integer DEFAULT 0 NOT NULL,
	`novel_dir_path` text,
	`is_nsfw` integer DEFAULT false NOT NULL,
	`description_inline_files` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_novels_status` ON `novels` (`status`);--> statement-breakpoint
CREATE INDEX `idx_novels_format` ON `novels` (`format`);--> statement-breakpoint
CREATE INDEX `idx_novels_is_favorite` ON `novels` (`is_favorite`);--> statement-breakpoint
CREATE INDEX `idx_novels_is_nsfw` ON `novels` (`is_nsfw`);--> statement-breakpoint
CREATE INDEX `idx_novels_last_active_at` ON `novels` (`last_active_at`);--> statement-breakpoint
CREATE INDEX `idx_novels_created_at` ON `novels` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_novels_name` ON `novels` (`name`);--> statement-breakpoint
CREATE INDEX `idx_novels_score` ON `novels` (`score`);--> statement-breakpoint
CREATE TABLE `novel_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`novel_id` text NOT NULL,
	`volume_id` text,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	FOREIGN KEY (`novel_id`) REFERENCES `novels`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`volume_id`) REFERENCES `novel_volumes`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_novel_sessions_novel_id` ON `novel_sessions` (`novel_id`);--> statement-breakpoint
CREATE INDEX `idx_novel_sessions_volume_id` ON `novel_sessions` (`volume_id`);--> statement-breakpoint
CREATE INDEX `idx_novel_sessions_started_at` ON `novel_sessions` (`started_at`);--> statement-breakpoint
CREATE TABLE `novel_volume_files` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`volume_id` text NOT NULL,
	`path` text NOT NULL,
	`file_size` integer,
	`file_mtime` integer,
	`container` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`is_manual` integer DEFAULT false NOT NULL,
	`note` text,
	FOREIGN KEY (`volume_id`) REFERENCES `novel_volumes`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `novel_volume_files_path_unique` ON `novel_volume_files` (`path`);--> statement-breakpoint
CREATE INDEX `idx_novel_volume_files_volume_id` ON `novel_volume_files` (`volume_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_novel_volume_files_primary` ON `novel_volume_files` (`volume_id`) WHERE is_primary = 1;--> statement-breakpoint
CREATE TABLE `novel_volumes` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`novel_id` text NOT NULL,
	`volume_number` real,
	`name` text,
	`original_name` text,
	`release_date` text,
	`description` text,
	`cover_file` text,
	`read` integer DEFAULT false NOT NULL,
	`read_at` integer,
	`read_count` integer DEFAULT 0 NOT NULL,
	`resume_locator` text,
	`resume_progress` real,
	`order_in_novel` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`novel_id`) REFERENCES `novels`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_novel_volumes_novel_id` ON `novel_volumes` (`novel_id`);--> statement-breakpoint
CREATE INDEX `idx_novel_volumes_novel_id_order` ON `novel_volumes` (`novel_id`,`order_in_novel`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_novel_volumes_number` ON `novel_volumes` (`novel_id`,`volume_number`) WHERE volume_number IS NOT NULL;--> statement-breakpoint
CREATE TABLE `comic_chapter_external_ids` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`chapter_id` text NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`order_in_chapter` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `comic_chapters`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_comic_chapter_external_ids_lookup` ON `comic_chapter_external_ids` (`source`,`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `comic_chapter_external_ids_chapter_id_source_external_id_unique` ON `comic_chapter_external_ids` (`chapter_id`,`source`,`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_comic_chapter_external_id` ON `comic_chapter_external_ids` (`source`,`external_id`);--> statement-breakpoint
CREATE TABLE `comic_external_ids` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`comic_id` text NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`order_in_comic` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`comic_id`) REFERENCES `comics`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_comic_external_ids_lookup` ON `comic_external_ids` (`source`,`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `comic_external_ids_comic_id_source_external_id_unique` ON `comic_external_ids` (`comic_id`,`source`,`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_comic_external_id` ON `comic_external_ids` (`source`,`external_id`);--> statement-breakpoint
CREATE TABLE `novel_external_ids` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`novel_id` text NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`order_in_novel` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`novel_id`) REFERENCES `novels`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_novel_external_ids_lookup` ON `novel_external_ids` (`source`,`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `novel_external_ids_novel_id_source_external_id_unique` ON `novel_external_ids` (`novel_id`,`source`,`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_novel_external_id` ON `novel_external_ids` (`source`,`external_id`);--> statement-breakpoint
CREATE TABLE `novel_volume_external_ids` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`volume_id` text NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`order_in_volume` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`volume_id`) REFERENCES `novel_volumes`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_novel_volume_external_ids_lookup` ON `novel_volume_external_ids` (`source`,`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `novel_volume_external_ids_volume_id_source_external_id_unique` ON `novel_volume_external_ids` (`volume_id`,`source`,`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_novel_volume_external_id` ON `novel_volume_external_ids` (`source`,`external_id`);--> statement-breakpoint
CREATE TABLE `collection_comic_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`collection_id` text NOT NULL,
	`comic_id` text NOT NULL,
	`note` text,
	`order_in_collection` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`comic_id`) REFERENCES `comics`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_collection_comic_links_collection_id` ON `collection_comic_links` (`collection_id`);--> statement-breakpoint
CREATE INDEX `idx_collection_comic_links_comic_id` ON `collection_comic_links` (`comic_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `collection_comic_links_collection_id_comic_id_unique` ON `collection_comic_links` (`collection_id`,`comic_id`);--> statement-breakpoint
CREATE TABLE `collection_novel_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`collection_id` text NOT NULL,
	`novel_id` text NOT NULL,
	`note` text,
	`order_in_collection` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`novel_id`) REFERENCES `novels`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_collection_novel_links_collection_id` ON `collection_novel_links` (`collection_id`);--> statement-breakpoint
CREATE INDEX `idx_collection_novel_links_novel_id` ON `collection_novel_links` (`novel_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `collection_novel_links_collection_id_novel_id_unique` ON `collection_novel_links` (`collection_id`,`novel_id`);--> statement-breakpoint
CREATE TABLE `comic_character_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`comic_id` text NOT NULL,
	`character_id` text NOT NULL,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`role` text DEFAULT 'other' NOT NULL,
	`note` text,
	`order_in_comic` integer DEFAULT 0 NOT NULL,
	`order_in_character` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`comic_id`) REFERENCES `comics`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_comic_character_links_comic_id` ON `comic_character_links` (`comic_id`);--> statement-breakpoint
CREATE INDEX `idx_comic_character_links_character_id` ON `comic_character_links` (`character_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `comic_character_links_comic_id_character_id_role_unique` ON `comic_character_links` (`comic_id`,`character_id`,`role`);--> statement-breakpoint
CREATE TABLE `comic_company_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`comic_id` text NOT NULL,
	`company_id` text NOT NULL,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`role` text DEFAULT 'other' NOT NULL,
	`note` text,
	`order_in_comic` integer DEFAULT 0 NOT NULL,
	`order_in_company` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`comic_id`) REFERENCES `comics`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_comic_company_links_comic_id` ON `comic_company_links` (`comic_id`);--> statement-breakpoint
CREATE INDEX `idx_comic_company_links_company_id` ON `comic_company_links` (`company_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `comic_company_links_comic_id_company_id_role_unique` ON `comic_company_links` (`comic_id`,`company_id`,`role`);--> statement-breakpoint
CREATE TABLE `comic_person_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`comic_id` text NOT NULL,
	`person_id` text NOT NULL,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`role` text DEFAULT 'other' NOT NULL,
	`note` text,
	`order_in_comic` integer DEFAULT 0 NOT NULL,
	`order_in_person` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`comic_id`) REFERENCES `comics`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_comic_person_links_comic_id` ON `comic_person_links` (`comic_id`);--> statement-breakpoint
CREATE INDEX `idx_comic_person_links_person_id` ON `comic_person_links` (`person_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `comic_person_links_comic_id_person_id_role_unique` ON `comic_person_links` (`comic_id`,`person_id`,`role`);--> statement-breakpoint
CREATE TABLE `novel_character_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`novel_id` text NOT NULL,
	`character_id` text NOT NULL,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`role` text DEFAULT 'other' NOT NULL,
	`note` text,
	`order_in_novel` integer DEFAULT 0 NOT NULL,
	`order_in_character` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`novel_id`) REFERENCES `novels`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_novel_character_links_novel_id` ON `novel_character_links` (`novel_id`);--> statement-breakpoint
CREATE INDEX `idx_novel_character_links_character_id` ON `novel_character_links` (`character_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `novel_character_links_novel_id_character_id_role_unique` ON `novel_character_links` (`novel_id`,`character_id`,`role`);--> statement-breakpoint
CREATE TABLE `novel_company_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`novel_id` text NOT NULL,
	`company_id` text NOT NULL,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`role` text DEFAULT 'other' NOT NULL,
	`note` text,
	`order_in_novel` integer DEFAULT 0 NOT NULL,
	`order_in_company` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`novel_id`) REFERENCES `novels`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_novel_company_links_novel_id` ON `novel_company_links` (`novel_id`);--> statement-breakpoint
CREATE INDEX `idx_novel_company_links_company_id` ON `novel_company_links` (`company_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `novel_company_links_novel_id_company_id_role_unique` ON `novel_company_links` (`novel_id`,`company_id`,`role`);--> statement-breakpoint
CREATE TABLE `novel_person_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`novel_id` text NOT NULL,
	`person_id` text NOT NULL,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`role` text DEFAULT 'other' NOT NULL,
	`note` text,
	`order_in_novel` integer DEFAULT 0 NOT NULL,
	`order_in_person` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`novel_id`) REFERENCES `novels`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_novel_person_links_novel_id` ON `novel_person_links` (`novel_id`);--> statement-breakpoint
CREATE INDEX `idx_novel_person_links_person_id` ON `novel_person_links` (`person_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `novel_person_links_novel_id_person_id_role_unique` ON `novel_person_links` (`novel_id`,`person_id`,`role`);--> statement-breakpoint
CREATE TABLE `comic_tag_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`comic_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`note` text,
	`order_in_comic` integer DEFAULT 0 NOT NULL,
	`order_in_tag` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`comic_id`) REFERENCES `comics`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_comic_tag_links_comic_id` ON `comic_tag_links` (`comic_id`);--> statement-breakpoint
CREATE INDEX `idx_comic_tag_links_tag_id` ON `comic_tag_links` (`tag_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `comic_tag_links_comic_id_tag_id_unique` ON `comic_tag_links` (`comic_id`,`tag_id`);--> statement-breakpoint
CREATE TABLE `novel_tag_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`novel_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`note` text,
	`order_in_novel` integer DEFAULT 0 NOT NULL,
	`order_in_tag` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`novel_id`) REFERENCES `novels`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_novel_tag_links_novel_id` ON `novel_tag_links` (`novel_id`);--> statement-breakpoint
CREATE INDEX `idx_novel_tag_links_tag_id` ON `novel_tag_links` (`tag_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `novel_tag_links_novel_id_tag_id_unique` ON `novel_tag_links` (`novel_id`,`tag_id`);