import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import { baseColumns, identityKeyText } from '../../columns'
import { animeEpisodes } from './anime'
import { animes, characters, companies, games, movies, persons, tvs } from './content'
import { tvEpisodes } from './tv'

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

export const tvExternalIds = sqliteTable(
  'tv_external_ids',
  {
    ...baseColumns,
    tvId: text('tv_id')
      .notNull()
      .references(() => tvs.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    source: identityKeyText('source').notNull(),
    externalId: identityKeyText('external_id').notNull(),
    orderInTv: integer('order_in_tv').notNull().default(0)
  },
  (t) => [
    unique().on(t.tvId, t.source, t.externalId),
    unique('unique_tv_external_id').on(t.source, t.externalId),
    index('idx_tv_external_ids_lookup').on(t.source, t.externalId)
  ]
)

/**
 * Per-episode identity.
 *
 * Kept from the first scrape so re-scrapes realign existing rows by id instead
 * of by episode number, which sources revise.
 */
export const tvEpisodeExternalIds = sqliteTable(
  'tv_episode_external_ids',
  {
    ...baseColumns,
    episodeId: text('episode_id')
      .notNull()
      .references(() => tvEpisodes.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    source: identityKeyText('source').notNull(),
    externalId: identityKeyText('external_id').notNull(),
    orderInEpisode: integer('order_in_episode').notNull().default(0)
  },
  (t) => [
    unique().on(t.episodeId, t.source, t.externalId),
    unique('unique_tv_episode_external_id').on(t.source, t.externalId),
    index('idx_tv_episode_external_ids_lookup').on(t.source, t.externalId)
  ]
)

export const movieExternalIds = sqliteTable(
  'movie_external_ids',
  {
    ...baseColumns,
    movieId: text('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    source: identityKeyText('source').notNull(),
    externalId: identityKeyText('external_id').notNull(),
    orderInMovie: integer('order_in_movie').notNull().default(0)
  },
  (t) => [
    unique().on(t.movieId, t.source, t.externalId),
    unique('unique_movie_external_id').on(t.source, t.externalId),
    index('idx_movie_external_ids_lookup').on(t.source, t.externalId)
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
export type AnimeEpisodeExternalId = InferSelectModel<typeof animeEpisodeExternalIds>
export type NewAnimeEpisodeExternalId = InferInsertModel<typeof animeEpisodeExternalIds>
export type TvExternalId = InferSelectModel<typeof tvExternalIds>
export type NewTvExternalId = InferInsertModel<typeof tvExternalIds>
export type TvEpisodeExternalId = InferSelectModel<typeof tvEpisodeExternalIds>
export type NewTvEpisodeExternalId = InferInsertModel<typeof tvEpisodeExternalIds>
export type MovieExternalId = InferSelectModel<typeof movieExternalIds>
export type NewMovieExternalId = InferInsertModel<typeof movieExternalIds>
export type PersonExternalId = InferSelectModel<typeof personExternalIds>
export type NewPersonExternalId = InferInsertModel<typeof personExternalIds>
export type CompanyExternalId = InferSelectModel<typeof companyExternalIds>
export type NewCompanyExternalId = InferInsertModel<typeof companyExternalIds>
export type CharacterExternalId = InferSelectModel<typeof characterExternalIds>
export type NewCharacterExternalId = InferInsertModel<typeof characterExternalIds>
