ALTER TABLE `game_person_links` RENAME COLUMN `type` TO `role`;
--> statement-breakpoint
DROP INDEX `game_person_links_game_id_person_id_type_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `game_person_links_game_id_person_id_role_unique` ON `game_person_links` (`game_id`,`person_id`,`role`);
--> statement-breakpoint
ALTER TABLE `game_company_links` RENAME COLUMN `type` TO `role`;
--> statement-breakpoint
DROP INDEX `game_company_links_game_id_company_id_type_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `game_company_links_game_id_company_id_role_unique` ON `game_company_links` (`game_id`,`company_id`,`role`);
--> statement-breakpoint
ALTER TABLE `game_character_links` RENAME COLUMN `type` TO `role`;
--> statement-breakpoint
DROP INDEX `game_character_links_game_id_character_id_type_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `game_character_links_game_id_character_id_role_unique` ON `game_character_links` (`game_id`,`character_id`,`role`);
--> statement-breakpoint
ALTER TABLE `anime_person_links` RENAME COLUMN `type` TO `role`;
--> statement-breakpoint
DROP INDEX `anime_person_links_anime_id_person_id_type_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `anime_person_links_anime_id_person_id_role_unique` ON `anime_person_links` (`anime_id`,`person_id`,`role`);
--> statement-breakpoint
ALTER TABLE `anime_company_links` RENAME COLUMN `type` TO `role`;
--> statement-breakpoint
DROP INDEX `anime_company_links_anime_id_company_id_type_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `anime_company_links_anime_id_company_id_role_unique` ON `anime_company_links` (`anime_id`,`company_id`,`role`);
--> statement-breakpoint
ALTER TABLE `anime_character_links` RENAME COLUMN `type` TO `role`;
--> statement-breakpoint
DROP INDEX `anime_character_links_anime_id_character_id_type_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `anime_character_links_anime_id_character_id_role_unique` ON `anime_character_links` (`anime_id`,`character_id`,`role`);
--> statement-breakpoint
ALTER TABLE `character_person_links` RENAME COLUMN `type` TO `role`;
--> statement-breakpoint
DROP INDEX `unique_character_person`;
--> statement-breakpoint
CREATE UNIQUE INDEX `character_person_links_character_id_person_id_role_unique` ON `character_person_links` (`character_id`,`person_id`,`role`);
--> statement-breakpoint
ALTER TABLE `games` RENAME COLUMN `related_sites` TO `external_sites`;
--> statement-breakpoint
ALTER TABLE `animes` RENAME COLUMN `related_sites` TO `external_sites`;
--> statement-breakpoint
ALTER TABLE `characters` RENAME COLUMN `related_sites` TO `external_sites`;
--> statement-breakpoint
ALTER TABLE `persons` RENAME COLUMN `related_sites` TO `external_sites`;
--> statement-breakpoint
ALTER TABLE `companies` RENAME COLUMN `related_sites` TO `external_sites`;
