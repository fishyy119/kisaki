DELETE FROM `media_relations` WHERE `from_type` IN ('tv', 'movie') OR `to_type` IN ('tv', 'movie');--> statement-breakpoint
DELETE FROM `showcase_sections` WHERE `entity_type` IN ('tv', 'movie');--> statement-breakpoint
DELETE FROM `scanners` WHERE `type` IN ('tv', 'movie');--> statement-breakpoint
DELETE FROM `scraper_profiles` WHERE `media_type` IN ('tv', 'movie');--> statement-breakpoint
DROP TABLE `collection_movie_links`;--> statement-breakpoint
DROP TABLE `collection_tv_links`;--> statement-breakpoint
DROP TABLE `movie_character_links`;--> statement-breakpoint
DROP TABLE `movie_company_links`;--> statement-breakpoint
DROP TABLE `movie_external_ids`;--> statement-breakpoint
DROP TABLE `movie_extra_files`;--> statement-breakpoint
DROP TABLE `movie_extras`;--> statement-breakpoint
DROP TABLE `movie_files`;--> statement-breakpoint
DROP TABLE `movie_notes`;--> statement-breakpoint
DROP TABLE `movie_person_links`;--> statement-breakpoint
DROP TABLE `movie_sessions`;--> statement-breakpoint
DROP TABLE `movie_tag_links`;--> statement-breakpoint
DROP TABLE `movies`;--> statement-breakpoint
DROP TABLE `tv_character_links`;--> statement-breakpoint
DROP TABLE `tv_company_links`;--> statement-breakpoint
DROP TABLE `tv_episode_external_ids`;--> statement-breakpoint
DROP TABLE `tv_episode_files`;--> statement-breakpoint
DROP TABLE `tv_episodes`;--> statement-breakpoint
DROP TABLE `tv_external_ids`;--> statement-breakpoint
DROP TABLE `tv_extra_files`;--> statement-breakpoint
DROP TABLE `tv_extras`;--> statement-breakpoint
DROP TABLE `tv_notes`;--> statement-breakpoint
DROP TABLE `tv_person_links`;--> statement-breakpoint
DROP TABLE `tv_seasons`;--> statement-breakpoint
DROP TABLE `tv_sessions`;--> statement-breakpoint
DROP TABLE `tv_tag_links`;--> statement-breakpoint
DROP TABLE `tvs`;--> statement-breakpoint
CREATE TABLE `anime_cast_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`anime_id` text NOT NULL,
	`character_id` text NOT NULL,
	`person_id` text NOT NULL,
	`note` text,
	FOREIGN KEY (`anime_id`) REFERENCES `animes`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_anime_cast_links_anime_id` ON `anime_cast_links` (`anime_id`);--> statement-breakpoint
CREATE INDEX `idx_anime_cast_links_character_id` ON `anime_cast_links` (`character_id`);--> statement-breakpoint
CREATE INDEX `idx_anime_cast_links_person_id` ON `anime_cast_links` (`person_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `anime_cast_links_anime_id_character_id_person_id_unique` ON `anime_cast_links` (`anime_id`,`character_id`,`person_id`);--> statement-breakpoint
CREATE TABLE `game_cast_links` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`game_id` text NOT NULL,
	`character_id` text NOT NULL,
	`person_id` text NOT NULL,
	`note` text,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_game_cast_links_game_id` ON `game_cast_links` (`game_id`);--> statement-breakpoint
CREATE INDEX `idx_game_cast_links_character_id` ON `game_cast_links` (`character_id`);--> statement-breakpoint
CREATE INDEX `idx_game_cast_links_person_id` ON `game_cast_links` (`person_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `game_cast_links_game_id_character_id_person_id_unique` ON `game_cast_links` (`game_id`,`character_id`,`person_id`);--> statement-breakpoint
CREATE TABLE `company_relations` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`from_id` text NOT NULL,
	`to_id` text NOT NULL,
	`type` text DEFAULT 'other' NOT NULL,
	`note` text,
	`order_in_from` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`from_id`) REFERENCES `companies`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`to_id`) REFERENCES `companies`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_company_relations_from` ON `company_relations` (`from_id`);--> statement-breakpoint
CREATE INDEX `idx_company_relations_to` ON `company_relations` (`to_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `company_relations_from_id_to_id_type_unique` ON `company_relations` (`from_id`,`to_id`,`type`);--> statement-breakpoint
ALTER TABLE `characters` ADD `aliases` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `persons` ADD `aliases` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `anime_person_links` DROP COLUMN `playing`;--> statement-breakpoint
ALTER TABLE `game_person_links` DROP COLUMN `playing`;
