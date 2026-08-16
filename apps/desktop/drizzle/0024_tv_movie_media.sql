CREATE TABLE `movie_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`movie_id` text NOT NULL,
	`name` text NOT NULL,
	`content` text,
	`content_inline_files` text DEFAULT '[]' NOT NULL,
	`cover_file` text,
	`order_in_movie` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_movie_notes_movie_id` ON `movie_notes` (`movie_id`);--> statement-breakpoint
CREATE INDEX `idx_movie_notes_movie_id_order` ON `movie_notes` (`movie_id`,`order_in_movie`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_movie_notes_movie_id_name` ON `movie_notes` (`movie_id`,`name`);--> statement-breakpoint
CREATE TABLE `movies` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`name` text DEFAULT 'unknown movie' NOT NULL,
	`original_name` text,
	`sort_name` text,
	`cover_file` text,
	`backdrop_file` text,
	`logo_file` text,
	`score` integer,
	`is_favorite` integer DEFAULT false NOT NULL,
	`release_date` text,
	`description` text,
	`external_sites` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`format` text DEFAULT 'theatrical' NOT NULL,
	`runtime_ms` integer,
	`watched` integer DEFAULT false NOT NULL,
	`watched_at` integer,
	`play_count` integer DEFAULT 0 NOT NULL,
	`resume_position_ms` integer,
	`last_active_at` integer,
	`total_duration` integer DEFAULT 0 NOT NULL,
	`movie_dir_path` text,
	`is_nsfw` integer DEFAULT false NOT NULL,
	`description_inline_files` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_movies_status` ON `movies` (`status`);--> statement-breakpoint
CREATE INDEX `idx_movies_format` ON `movies` (`format`);--> statement-breakpoint
CREATE INDEX `idx_movies_watched` ON `movies` (`watched`);--> statement-breakpoint
CREATE INDEX `idx_movies_is_favorite` ON `movies` (`is_favorite`);--> statement-breakpoint
CREATE INDEX `idx_movies_is_nsfw` ON `movies` (`is_nsfw`);--> statement-breakpoint
CREATE INDEX `idx_movies_last_active_at` ON `movies` (`last_active_at`);--> statement-breakpoint
CREATE INDEX `idx_movies_created_at` ON `movies` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_movies_name` ON `movies` (`name`);--> statement-breakpoint
CREATE INDEX `idx_movies_score` ON `movies` (`score`);--> statement-breakpoint
CREATE TABLE `tv_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`tv_id` text NOT NULL,
	`name` text NOT NULL,
	`content` text,
	`content_inline_files` text DEFAULT '[]' NOT NULL,
	`cover_file` text,
	`order_in_tv` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tv_id`) REFERENCES `tvs`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tv_notes_tv_id` ON `tv_notes` (`tv_id`);--> statement-breakpoint
CREATE INDEX `idx_tv_notes_tv_id_order` ON `tv_notes` (`tv_id`,`order_in_tv`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_tv_notes_tv_id_name` ON `tv_notes` (`tv_id`,`name`);--> statement-breakpoint
CREATE TABLE `tvs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`name` text DEFAULT 'unknown tv' NOT NULL,
	`original_name` text,
	`sort_name` text,
	`cover_file` text,
	`backdrop_file` text,
	`logo_file` text,
	`score` integer,
	`is_favorite` integer DEFAULT false NOT NULL,
	`release_date` text,
	`end_date` text,
	`description` text,
	`external_sites` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`format` text DEFAULT 'scripted' NOT NULL,
	`total_seasons` integer,
	`total_episodes` integer,
	`last_active_at` integer,
	`total_duration` integer DEFAULT 0 NOT NULL,
	`tv_dir_path` text,
	`is_nsfw` integer DEFAULT false NOT NULL,
	`description_inline_files` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tvs_status` ON `tvs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_tvs_format` ON `tvs` (`format`);--> statement-breakpoint
CREATE INDEX `idx_tvs_is_favorite` ON `tvs` (`is_favorite`);--> statement-breakpoint
CREATE INDEX `idx_tvs_is_nsfw` ON `tvs` (`is_nsfw`);--> statement-breakpoint
CREATE INDEX `idx_tvs_last_active_at` ON `tvs` (`last_active_at`);--> statement-breakpoint
CREATE INDEX `idx_tvs_created_at` ON `tvs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_tvs_name` ON `tvs` (`name`);--> statement-breakpoint
CREATE INDEX `idx_tvs_score` ON `tvs` (`score`);--> statement-breakpoint
CREATE TABLE `movie_external_ids` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`movie_id` text NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`order_in_movie` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_movie_external_ids_lookup` ON `movie_external_ids` (`source`,`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `movie_external_ids_movie_id_source_external_id_unique` ON `movie_external_ids` (`movie_id`,`source`,`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_movie_external_id` ON `movie_external_ids` (`source`,`external_id`);--> statement-breakpoint
CREATE TABLE `tv_episode_external_ids` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`episode_id` text NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`order_in_episode` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`episode_id`) REFERENCES `tv_episodes`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tv_episode_external_ids_lookup` ON `tv_episode_external_ids` (`source`,`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tv_episode_external_ids_episode_id_source_external_id_unique` ON `tv_episode_external_ids` (`episode_id`,`source`,`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_tv_episode_external_id` ON `tv_episode_external_ids` (`source`,`external_id`);--> statement-breakpoint
CREATE TABLE `tv_external_ids` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`tv_id` text NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`order_in_tv` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tv_id`) REFERENCES `tvs`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tv_external_ids_lookup` ON `tv_external_ids` (`source`,`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tv_external_ids_tv_id_source_external_id_unique` ON `tv_external_ids` (`tv_id`,`source`,`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_tv_external_id` ON `tv_external_ids` (`source`,`external_id`);--> statement-breakpoint
CREATE TABLE `collection_movie_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`collection_id` text NOT NULL,
	`movie_id` text NOT NULL,
	`note` text,
	`order_in_collection` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_collection_movie_links_collection_id` ON `collection_movie_links` (`collection_id`);--> statement-breakpoint
CREATE INDEX `idx_collection_movie_links_movie_id` ON `collection_movie_links` (`movie_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `collection_movie_links_collection_id_movie_id_unique` ON `collection_movie_links` (`collection_id`,`movie_id`);--> statement-breakpoint
CREATE TABLE `collection_tv_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`collection_id` text NOT NULL,
	`tv_id` text NOT NULL,
	`note` text,
	`order_in_collection` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`tv_id`) REFERENCES `tvs`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_collection_tv_links_collection_id` ON `collection_tv_links` (`collection_id`);--> statement-breakpoint
CREATE INDEX `idx_collection_tv_links_tv_id` ON `collection_tv_links` (`tv_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `collection_tv_links_collection_id_tv_id_unique` ON `collection_tv_links` (`collection_id`,`tv_id`);--> statement-breakpoint
CREATE TABLE `movie_character_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`movie_id` text NOT NULL,
	`character_id` text NOT NULL,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`role` text DEFAULT 'other' NOT NULL,
	`note` text,
	`order_in_movie` integer DEFAULT 0 NOT NULL,
	`order_in_character` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_movie_character_links_movie_id` ON `movie_character_links` (`movie_id`);--> statement-breakpoint
CREATE INDEX `idx_movie_character_links_character_id` ON `movie_character_links` (`character_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `movie_character_links_movie_id_character_id_role_unique` ON `movie_character_links` (`movie_id`,`character_id`,`role`);--> statement-breakpoint
CREATE TABLE `movie_company_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`movie_id` text NOT NULL,
	`company_id` text NOT NULL,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`role` text DEFAULT 'other' NOT NULL,
	`note` text,
	`order_in_movie` integer DEFAULT 0 NOT NULL,
	`order_in_company` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_movie_company_links_movie_id` ON `movie_company_links` (`movie_id`);--> statement-breakpoint
CREATE INDEX `idx_movie_company_links_company_id` ON `movie_company_links` (`company_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `movie_company_links_movie_id_company_id_role_unique` ON `movie_company_links` (`movie_id`,`company_id`,`role`);--> statement-breakpoint
CREATE TABLE `movie_person_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`movie_id` text NOT NULL,
	`person_id` text NOT NULL,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`role` text DEFAULT 'other' NOT NULL,
	`note` text,
	`order_in_movie` integer DEFAULT 0 NOT NULL,
	`order_in_person` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_movie_person_links_movie_id` ON `movie_person_links` (`movie_id`);--> statement-breakpoint
CREATE INDEX `idx_movie_person_links_person_id` ON `movie_person_links` (`person_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `movie_person_links_movie_id_person_id_role_unique` ON `movie_person_links` (`movie_id`,`person_id`,`role`);--> statement-breakpoint
CREATE TABLE `tv_character_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`tv_id` text NOT NULL,
	`character_id` text NOT NULL,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`role` text DEFAULT 'other' NOT NULL,
	`note` text,
	`order_in_tv` integer DEFAULT 0 NOT NULL,
	`order_in_character` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tv_id`) REFERENCES `tvs`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tv_character_links_tv_id` ON `tv_character_links` (`tv_id`);--> statement-breakpoint
CREATE INDEX `idx_tv_character_links_character_id` ON `tv_character_links` (`character_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tv_character_links_tv_id_character_id_role_unique` ON `tv_character_links` (`tv_id`,`character_id`,`role`);--> statement-breakpoint
CREATE TABLE `tv_company_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`tv_id` text NOT NULL,
	`company_id` text NOT NULL,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`role` text DEFAULT 'other' NOT NULL,
	`note` text,
	`order_in_tv` integer DEFAULT 0 NOT NULL,
	`order_in_company` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tv_id`) REFERENCES `tvs`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tv_company_links_tv_id` ON `tv_company_links` (`tv_id`);--> statement-breakpoint
CREATE INDEX `idx_tv_company_links_company_id` ON `tv_company_links` (`company_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tv_company_links_tv_id_company_id_role_unique` ON `tv_company_links` (`tv_id`,`company_id`,`role`);--> statement-breakpoint
CREATE TABLE `tv_person_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`tv_id` text NOT NULL,
	`person_id` text NOT NULL,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`role` text DEFAULT 'other' NOT NULL,
	`note` text,
	`order_in_tv` integer DEFAULT 0 NOT NULL,
	`order_in_person` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tv_id`) REFERENCES `tvs`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tv_person_links_tv_id` ON `tv_person_links` (`tv_id`);--> statement-breakpoint
CREATE INDEX `idx_tv_person_links_person_id` ON `tv_person_links` (`person_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tv_person_links_tv_id_person_id_role_unique` ON `tv_person_links` (`tv_id`,`person_id`,`role`);--> statement-breakpoint
CREATE TABLE `movie_extra_files` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`extra_id` text NOT NULL,
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
	`is_manual` integer DEFAULT false NOT NULL,
	`note` text,
	FOREIGN KEY (`extra_id`) REFERENCES `movie_extras`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `movie_extra_files_path_unique` ON `movie_extra_files` (`path`);--> statement-breakpoint
CREATE INDEX `idx_movie_extra_files_extra_id` ON `movie_extra_files` (`extra_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_movie_extra_files_primary` ON `movie_extra_files` (`extra_id`) WHERE is_primary = 1;--> statement-breakpoint
CREATE TABLE `movie_extras` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`movie_id` text NOT NULL,
	`type` text DEFAULT 'other' NOT NULL,
	`name` text NOT NULL,
	`order_in_movie` integer DEFAULT 0 NOT NULL,
	`is_manual` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_movie_extras_movie_id` ON `movie_extras` (`movie_id`);--> statement-breakpoint
CREATE TABLE `movie_files` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`movie_id` text NOT NULL,
	`path` text NOT NULL,
	`edition` text,
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
	`is_manual` integer DEFAULT false NOT NULL,
	`note` text,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `movie_files_path_unique` ON `movie_files` (`path`);--> statement-breakpoint
CREATE INDEX `idx_movie_files_movie_id` ON `movie_files` (`movie_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_movie_files_primary` ON `movie_files` (`movie_id`) WHERE is_primary = 1;--> statement-breakpoint
CREATE TABLE `movie_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`movie_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_movie_sessions_movie_id` ON `movie_sessions` (`movie_id`);--> statement-breakpoint
CREATE INDEX `idx_movie_sessions_started_at` ON `movie_sessions` (`started_at`);--> statement-breakpoint
CREATE TABLE `movie_tag_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`movie_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`note` text,
	`order_in_movie` integer DEFAULT 0 NOT NULL,
	`order_in_tag` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_movie_tag_links_movie_id` ON `movie_tag_links` (`movie_id`);--> statement-breakpoint
CREATE INDEX `idx_movie_tag_links_tag_id` ON `movie_tag_links` (`tag_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `movie_tag_links_movie_id_tag_id_unique` ON `movie_tag_links` (`movie_id`,`tag_id`);--> statement-breakpoint
CREATE TABLE `tv_tag_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`tv_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`note` text,
	`order_in_tv` integer DEFAULT 0 NOT NULL,
	`order_in_tag` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tv_id`) REFERENCES `tvs`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tv_tag_links_tv_id` ON `tv_tag_links` (`tv_id`);--> statement-breakpoint
CREATE INDEX `idx_tv_tag_links_tag_id` ON `tv_tag_links` (`tag_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tv_tag_links_tv_id_tag_id_unique` ON `tv_tag_links` (`tv_id`,`tag_id`);--> statement-breakpoint
CREATE TABLE `tv_episode_files` (
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
	`is_manual` integer DEFAULT false NOT NULL,
	`note` text,
	FOREIGN KEY (`episode_id`) REFERENCES `tv_episodes`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tv_episode_files_path_unique` ON `tv_episode_files` (`path`);--> statement-breakpoint
CREATE INDEX `idx_tv_episode_files_episode_id` ON `tv_episode_files` (`episode_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_tv_episode_files_primary` ON `tv_episode_files` (`episode_id`) WHERE is_primary = 1;--> statement-breakpoint
CREATE TABLE `tv_episodes` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`tv_id` text NOT NULL,
	`season_id` text NOT NULL,
	`episode_number` integer,
	`name` text,
	`original_name` text,
	`air_date` text,
	`description` text,
	`still_file` text,
	`duration_ms` integer,
	`watched` integer DEFAULT false NOT NULL,
	`watched_at` integer,
	`play_count` integer DEFAULT 0 NOT NULL,
	`resume_position_ms` integer,
	`order_in_season` integer DEFAULT 0 NOT NULL,
	`order_in_tv` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tv_id`) REFERENCES `tvs`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`season_id`) REFERENCES `tv_seasons`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tv_episodes_tv_id` ON `tv_episodes` (`tv_id`);--> statement-breakpoint
CREATE INDEX `idx_tv_episodes_season_id` ON `tv_episodes` (`season_id`);--> statement-breakpoint
CREATE INDEX `idx_tv_episodes_tv_id_order` ON `tv_episodes` (`tv_id`,`order_in_tv`);--> statement-breakpoint
CREATE INDEX `idx_tv_episodes_season_id_order` ON `tv_episodes` (`season_id`,`order_in_season`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_tv_episodes_number` ON `tv_episodes` (`season_id`,`episode_number`) WHERE episode_number IS NOT NULL;--> statement-breakpoint
CREATE TABLE `tv_extra_files` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`extra_id` text NOT NULL,
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
	`is_manual` integer DEFAULT false NOT NULL,
	`note` text,
	FOREIGN KEY (`extra_id`) REFERENCES `tv_extras`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tv_extra_files_path_unique` ON `tv_extra_files` (`path`);--> statement-breakpoint
CREATE INDEX `idx_tv_extra_files_extra_id` ON `tv_extra_files` (`extra_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_tv_extra_files_primary` ON `tv_extra_files` (`extra_id`) WHERE is_primary = 1;--> statement-breakpoint
CREATE TABLE `tv_extras` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`tv_id` text NOT NULL,
	`type` text DEFAULT 'other' NOT NULL,
	`name` text NOT NULL,
	`order_in_tv` integer DEFAULT 0 NOT NULL,
	`is_manual` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`tv_id`) REFERENCES `tvs`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tv_extras_tv_id` ON `tv_extras` (`tv_id`);--> statement-breakpoint
CREATE TABLE `tv_seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`tv_id` text NOT NULL,
	`season_number` integer NOT NULL,
	`name` text,
	`original_name` text,
	`air_date` text,
	`description` text,
	`poster_file` text,
	`total_episodes` integer,
	`order_in_tv` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tv_id`) REFERENCES `tvs`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tv_seasons_tv_id` ON `tv_seasons` (`tv_id`);--> statement-breakpoint
CREATE INDEX `idx_tv_seasons_tv_id_order` ON `tv_seasons` (`tv_id`,`order_in_tv`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_tv_seasons_number` ON `tv_seasons` (`tv_id`,`season_number`);--> statement-breakpoint
CREATE TABLE `tv_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`tv_id` text NOT NULL,
	`episode_id` text,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	FOREIGN KEY (`tv_id`) REFERENCES `tvs`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`episode_id`) REFERENCES `tv_episodes`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_tv_sessions_tv_id` ON `tv_sessions` (`tv_id`);--> statement-breakpoint
CREATE INDEX `idx_tv_sessions_episode_id` ON `tv_sessions` (`episode_id`);--> statement-breakpoint
CREATE INDEX `idx_tv_sessions_started_at` ON `tv_sessions` (`started_at`);