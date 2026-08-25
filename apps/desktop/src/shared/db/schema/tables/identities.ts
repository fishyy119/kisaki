import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import { baseColumns, identityKeyText } from '../../columns'
import { animeEpisodes } from './anime'
import { comicChapters } from './comic'
import { novelVolumes } from './novel'
import { animes, characters, comics, companies, games, novels, persons } from './content'

export const gameExternalIds = sqliteTable(
  'game_external_ids',
  {
    ...baseColumns,
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    source: identityKeyText('source').notNull(),
    externalId: identityKeyText('external_id').notNull(),
    orderInGame: integer('order_in_game').notNull().default(0)
  },
  (t) => [
    unique().on(t.gameId, t.source, t.externalId),
    unique('unique_game_external_id').on(t.source, t.externalId),
    index('idx_game_external_ids_lookup').on(t.source, t.externalId)
  ]
)

export const animeExternalIds = sqliteTable(
  'anime_external_ids',
  {
    ...baseColumns,
    animeId: text('anime_id')
      .notNull()
      .references(() => animes.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    source: identityKeyText('source').notNull(),
    externalId: identityKeyText('external_id').notNull(),
    orderInAnime: integer('order_in_anime').notNull().default(0)
  },
  (t) => [
    unique().on(t.animeId, t.source, t.externalId),
    unique('unique_anime_external_id').on(t.source, t.externalId),
    index('idx_anime_external_ids_lookup').on(t.source, t.externalId)
  ]
)

/**
 * Per-episode identity.
 *
 * Kept from the first scrape so re-scrapes realign existing rows by id instead
 * of by episode number, which sources revise.
 */
export const animeEpisodeExternalIds = sqliteTable(
  'anime_episode_external_ids',
  {
    ...baseColumns,
    episodeId: text('episode_id')
      .notNull()
      .references(() => animeEpisodes.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    source: identityKeyText('source').notNull(),
    externalId: identityKeyText('external_id').notNull(),
    orderInEpisode: integer('order_in_episode').notNull().default(0)
  },
  (t) => [
    unique().on(t.episodeId, t.source, t.externalId),
    unique('unique_anime_episode_external_id').on(t.source, t.externalId),
    index('idx_anime_episode_external_ids_lookup').on(t.source, t.externalId)
  ]
)

export const comicExternalIds = sqliteTable(
  'comic_external_ids',
  {
    ...baseColumns,
    comicId: text('comic_id')
      .notNull()
      .references(() => comics.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    source: identityKeyText('source').notNull(),
    externalId: identityKeyText('external_id').notNull(),
    orderInComic: integer('order_in_comic').notNull().default(0)
  },
  (t) => [
    unique().on(t.comicId, t.source, t.externalId),
    unique('unique_comic_external_id').on(t.source, t.externalId),
    index('idx_comic_external_ids_lookup').on(t.source, t.externalId)
  ]
)

/**
 * Per-unit identity.
 *
 * Kept from the first scrape so re-scrapes realign existing rows by id instead
 * of by number, which sources revise.
 */
export const comicChapterExternalIds = sqliteTable(
  'comic_chapter_external_ids',
  {
    ...baseColumns,
    chapterId: text('chapter_id')
      .notNull()
      .references(() => comicChapters.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    source: identityKeyText('source').notNull(),
    externalId: identityKeyText('external_id').notNull(),
    orderInChapter: integer('order_in_chapter').notNull().default(0)
  },
  (t) => [
    unique().on(t.chapterId, t.source, t.externalId),
    unique('unique_comic_chapter_external_id').on(t.source, t.externalId),
    index('idx_comic_chapter_external_ids_lookup').on(t.source, t.externalId)
  ]
)

export const novelExternalIds = sqliteTable(
  'novel_external_ids',
  {
    ...baseColumns,
    novelId: text('novel_id')
      .notNull()
      .references(() => novels.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    source: identityKeyText('source').notNull(),
    externalId: identityKeyText('external_id').notNull(),
    orderInNovel: integer('order_in_novel').notNull().default(0)
  },
  (t) => [
    unique().on(t.novelId, t.source, t.externalId),
    unique('unique_novel_external_id').on(t.source, t.externalId),
    index('idx_novel_external_ids_lookup').on(t.source, t.externalId)
  ]
)

/**
 * Per-volume identity.
 *
 * Kept from the first scrape so re-scrapes realign existing rows by id instead
 * of by number, which sources revise.
 */
export const novelVolumeExternalIds = sqliteTable(
  'novel_volume_external_ids',
  {
    ...baseColumns,
    volumeId: text('volume_id')
      .notNull()
      .references(() => novelVolumes.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    source: identityKeyText('source').notNull(),
    externalId: identityKeyText('external_id').notNull(),
    orderInVolume: integer('order_in_volume').notNull().default(0)
  },
  (t) => [
    unique().on(t.volumeId, t.source, t.externalId),
    unique('unique_novel_volume_external_id').on(t.source, t.externalId),
    index('idx_novel_volume_external_ids_lookup').on(t.source, t.externalId)
  ]
)

export const personExternalIds = sqliteTable(
  'person_external_ids',
  {
    ...baseColumns,
    personId: text('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    source: identityKeyText('source').notNull(),
    externalId: identityKeyText('external_id').notNull(),
    orderInPerson: integer('order_in_person').notNull().default(0)
  },
  (t) => [
    unique().on(t.personId, t.source, t.externalId),
    unique('unique_person_external_id').on(t.source, t.externalId),
    index('idx_person_external_ids_lookup').on(t.source, t.externalId)
  ]
)

export const companyExternalIds = sqliteTable(
  'company_external_ids',
  {
    ...baseColumns,
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    source: identityKeyText('source').notNull(),
    externalId: identityKeyText('external_id').notNull(),
    orderInCompany: integer('order_in_company').notNull().default(0)
  },
  (t) => [
    unique().on(t.companyId, t.source, t.externalId),
    unique('unique_company_external_id').on(t.source, t.externalId),
    index('idx_company_external_ids_lookup').on(t.source, t.externalId)
  ]
)

export const characterExternalIds = sqliteTable(
  'character_external_ids',
  {
    ...baseColumns,
    characterId: text('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    source: identityKeyText('source').notNull(),
    externalId: identityKeyText('external_id').notNull(),
    orderInCharacter: integer('order_in_character').notNull().default(0)
  },
  (t) => [
    unique().on(t.characterId, t.source, t.externalId),
    unique('unique_character_external_id').on(t.source, t.externalId),
    index('idx_character_external_ids_lookup').on(t.source, t.externalId)
  ]
)

export type GameExternalId = InferSelectModel<typeof gameExternalIds>
export type NewGameExternalId = InferInsertModel<typeof gameExternalIds>
export type AnimeExternalId = InferSelectModel<typeof animeExternalIds>
export type NewAnimeExternalId = InferInsertModel<typeof animeExternalIds>
export type ComicExternalId = InferSelectModel<typeof comicExternalIds>
export type NewComicExternalId = InferInsertModel<typeof comicExternalIds>
export type ComicChapterExternalId = InferSelectModel<typeof comicChapterExternalIds>
export type NewComicChapterExternalId = InferInsertModel<typeof comicChapterExternalIds>
export type NovelExternalId = InferSelectModel<typeof novelExternalIds>
export type NewNovelExternalId = InferInsertModel<typeof novelExternalIds>
export type NovelVolumeExternalId = InferSelectModel<typeof novelVolumeExternalIds>
export type NewNovelVolumeExternalId = InferInsertModel<typeof novelVolumeExternalIds>
export type AnimeEpisodeExternalId = InferSelectModel<typeof animeEpisodeExternalIds>
export type NewAnimeEpisodeExternalId = InferInsertModel<typeof animeEpisodeExternalIds>
export type PersonExternalId = InferSelectModel<typeof personExternalIds>
export type NewPersonExternalId = InferInsertModel<typeof personExternalIds>
export type CompanyExternalId = InferSelectModel<typeof companyExternalIds>
export type NewCompanyExternalId = InferInsertModel<typeof companyExternalIds>
export type CharacterExternalId = InferSelectModel<typeof characterExternalIds>
export type NewCharacterExternalId = InferInsertModel<typeof characterExternalIds>
