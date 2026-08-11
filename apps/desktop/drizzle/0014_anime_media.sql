CREATE TABLE `anime_episode_files` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`episode_id` text NOT NULL,
	`path` text NOT NULL,
	`file_size` integer,
	`file_mtime` integer,
	`container` text,
	`video_codec` text,
	`bit_depth` integer,
	`width` integer,
	`height` integer,
	`duration_ms` integer,
	`audio_tracks` text DEFAULT '[]' NOT NULL,
	`subtitle_tracks` text DEFAULT '[]' NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`note` text,
	FOREIGN KEY (`episode_id`) REFERENCES `anime_episodes`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `anime_episode_files_path_unique` ON `anime_episode_files` (`path`);--> statement-breakpoint
CREATE INDEX `idx_anime_episode_files_episode_id` ON `anime_episode_files` (`episode_id`);--> statement-breakpoint
CREATE TABLE `anime_episodes` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`anime_id` text NOT NULL,
	`type` text DEFAULT 'regular' NOT NULL,
	`episode_number` real,
	`name` text,
	`original_name` text,
	`air_date` text,
	`description` text,
	`still_file` text,
	`duration_ms` integer,
	`watched_at` integer,
	`play_count` integer DEFAULT 0 NOT NULL,
	`resume_position_ms` integer,
	`order_in_anime` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`anime_id`) REFERENCES `animes`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_anime_episodes_anime_id` ON `anime_episodes` (`anime_id`);--> statement-breakpoint
CREATE INDEX `idx_anime_episodes_anime_id_order` ON `anime_episodes` (`anime_id`,`order_in_anime`);--> statement-breakpoint
CREATE INDEX `idx_anime_episodes_watched_at` ON `anime_episodes` (`watched_at`);--> statement-breakpoint
CREATE TABLE `anime_extras` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`anime_id` text NOT NULL,
	`kind` text DEFAULT 'other' NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`duration_ms` integer,
	`order_in_anime` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`anime_id`) REFERENCES `animes`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `anime_extras_path_unique` ON `anime_extras` (`path`);--> statement-breakpoint
CREATE INDEX `idx_anime_extras_anime_id` ON `anime_extras` (`anime_id`);--> statement-breakpoint
CREATE TABLE `anime_relations` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`anime_id` text NOT NULL,
	`related_anime_id` text NOT NULL,
	`type` text DEFAULT 'other' NOT NULL,
	`note` text,
	`order_in_anime` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`anime_id`) REFERENCES `animes`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`related_anime_id`) REFERENCES `animes`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_anime_relations_anime_id` ON `anime_relations` (`anime_id`);--> statement-breakpoint
CREATE INDEX `idx_anime_relations_related_anime_id` ON `anime_relations` (`related_anime_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_anime_relation` ON `anime_relations` (`anime_id`,`related_anime_id`,`type`);--> statement-breakpoint
CREATE TABLE `anime_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`anime_id` text NOT NULL,
	`episode_id` text,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	FOREIGN KEY (`anime_id`) REFERENCES `animes`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`episode_id`) REFERENCES `anime_episodes`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_anime_sessions_anime_id` ON `anime_sessions` (`anime_id`);--> statement-breakpoint
CREATE INDEX `idx_anime_sessions_episode_id` ON `anime_sessions` (`episode_id`);--> statement-breakpoint
CREATE INDEX `idx_anime_sessions_started_at` ON `anime_sessions` (`started_at`);--> statement-breakpoint
CREATE TABLE `animes` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`name` text DEFAULT 'unknown anime' NOT NULL,
	`original_name` text,
	`sort_name` text,
	`cover_file` text,
	`backdrop_file` text,
	`logo_file` text,
	`score` integer,
	`is_favorite` integer DEFAULT false NOT NULL,
	`release_date` text,
	`description` text,
	`related_sites` text,
	`status` text DEFAULT 'notStarted' NOT NULL,
	`format` text DEFAULT 'tv' NOT NULL,
	`total_episodes` integer,
	`last_active_at` integer,
	`total_duration` integer DEFAULT 0 NOT NULL,
	`anime_dir_path` text,
	`is_nsfw` integer DEFAULT false NOT NULL,
	`description_inline_files` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_animes_status` ON `animes` (`status`);--> statement-breakpoint
CREATE INDEX `idx_animes_format` ON `animes` (`format`);--> statement-breakpoint
CREATE INDEX `idx_animes_is_favorite` ON `animes` (`is_favorite`);--> statement-breakpoint
CREATE INDEX `idx_animes_is_nsfw` ON `animes` (`is_nsfw`);--> statement-breakpoint
CREATE INDEX `idx_animes_last_active_at` ON `animes` (`last_active_at`);--> statement-breakpoint
CREATE INDEX `idx_animes_created_at` ON `animes` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_animes_name` ON `animes` (`name`);--> statement-breakpoint
CREATE INDEX `idx_animes_score` ON `animes` (`score`);--> statement-breakpoint
CREATE TABLE `anime_episode_external_ids` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`episode_id` text NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`order_in_episode` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`episode_id`) REFERENCES `anime_episodes`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_anime_episode_external_ids_lookup` ON `anime_episode_external_ids` (`source`,`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `anime_episode_external_ids_episode_id_source_external_id_unique` ON `anime_episode_external_ids` (`episode_id`,`source`,`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_anime_episode_external_id` ON `anime_episode_external_ids` (`source`,`external_id`);--> statement-breakpoint
CREATE TABLE `anime_external_ids` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`anime_id` text NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`order_in_anime` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`anime_id`) REFERENCES `animes`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_anime_external_ids_lookup` ON `anime_external_ids` (`source`,`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `anime_external_ids_anime_id_source_external_id_unique` ON `anime_external_ids` (`anime_id`,`source`,`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_anime_external_id` ON `anime_external_ids` (`source`,`external_id`);--> statement-breakpoint
CREATE TABLE `anime_character_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`anime_id` text NOT NULL,
	`character_id` text NOT NULL,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`type` text DEFAULT 'other' NOT NULL,
	`note` text,
	`order_in_anime` integer DEFAULT 0 NOT NULL,
	`order_in_character` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`anime_id`) REFERENCES `animes`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_anime_character_links_anime_id` ON `anime_character_links` (`anime_id`);--> statement-breakpoint
CREATE INDEX `idx_anime_character_links_character_id` ON `anime_character_links` (`character_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `anime_character_links_anime_id_character_id_type_unique` ON `anime_character_links` (`anime_id`,`character_id`,`type`);--> statement-breakpoint
CREATE TABLE `anime_company_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`anime_id` text NOT NULL,
	`company_id` text NOT NULL,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`type` text DEFAULT 'other' NOT NULL,
	`note` text,
	`order_in_anime` integer DEFAULT 0 NOT NULL,
	`order_in_company` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`anime_id`) REFERENCES `animes`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_anime_company_links_anime_id` ON `anime_company_links` (`anime_id`);--> statement-breakpoint
CREATE INDEX `idx_anime_company_links_company_id` ON `anime_company_links` (`company_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `anime_company_links_anime_id_company_id_type_unique` ON `anime_company_links` (`anime_id`,`company_id`,`type`);--> statement-breakpoint
CREATE TABLE `anime_person_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`anime_id` text NOT NULL,
	`person_id` text NOT NULL,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`type` text DEFAULT 'other' NOT NULL,
	`note` text,
	`order_in_anime` integer DEFAULT 0 NOT NULL,
	`order_in_person` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`anime_id`) REFERENCES `animes`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_anime_person_links_anime_id` ON `anime_person_links` (`anime_id`);--> statement-breakpoint
CREATE INDEX `idx_anime_person_links_person_id` ON `anime_person_links` (`person_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `anime_person_links_anime_id_person_id_type_unique` ON `anime_person_links` (`anime_id`,`person_id`,`type`);--> statement-breakpoint
CREATE TABLE `collection_anime_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`collection_id` text NOT NULL,
	`anime_id` text NOT NULL,
	`note` text,
	`order_in_collection` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`anime_id`) REFERENCES `animes`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_collection_anime_links_collection_id` ON `collection_anime_links` (`collection_id`);--> statement-breakpoint
CREATE INDEX `idx_collection_anime_links_anime_id` ON `collection_anime_links` (`anime_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `collection_anime_links_collection_id_anime_id_unique` ON `collection_anime_links` (`collection_id`,`anime_id`);--> statement-breakpoint
CREATE TABLE `anime_tag_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`anime_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`note` text,
	`order_in_anime` integer DEFAULT 0 NOT NULL,
	`order_in_tag` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`anime_id`) REFERENCES `animes`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_anime_tag_links_anime_id` ON `anime_tag_links` (`anime_id`);--> statement-breakpoint
CREATE INDEX `idx_anime_tag_links_tag_id` ON `anime_tag_links` (`tag_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `anime_tag_links_anime_id_tag_id_unique` ON `anime_tag_links` (`anime_id`,`tag_id`);--> statement-breakpoint
ALTER TABLE `settings` ADD `player_audio_languages` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `player_subtitle_languages` text DEFAULT '[]' NOT NULL;