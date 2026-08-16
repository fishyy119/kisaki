import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import {
  animeCharacterRole,
  animeCompanyRole,
  animePersonRole,
  baseColumns,
  characterPersonRole,
  gameCharacterRole,
  gameCompanyRole,
  gamePersonRole,
  movieCharacterRole,
  movieCompanyRole,
  moviePersonRole,
  tvCharacterRole,
  tvCompanyRole,
  tvPersonRole
} from '../../columns'
import { collections } from './collections'
import { animes, characters, companies, games, movies, persons, tvs } from './content'

export const gamePersonLinks = sqliteTable(
  'game_person_links',
  {
    ...baseColumns,
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    personId: text('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    role: gamePersonRole('role').notNull().default('other'),
    note: text('note'),
    orderInGame: integer('order_in_game').notNull().default(0),
    orderInPerson: integer('order_in_person').notNull().default(0)
  },
  (t) => [
    unique().on(t.gameId, t.personId, t.role),
    index('idx_game_person_links_game_id').on(t.gameId),
    index('idx_game_person_links_person_id').on(t.personId)
  ]
)

export const gameCompanyLinks = sqliteTable(
  'game_company_links',
  {
    ...baseColumns,
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    role: gameCompanyRole('role').notNull().default('other'),
    note: text('note'),
    orderInGame: integer('order_in_game').notNull().default(0),
    orderInCompany: integer('order_in_company').notNull().default(0)
  },
  (t) => [
    unique().on(t.gameId, t.companyId, t.role),
    index('idx_game_company_links_game_id').on(t.gameId),
    index('idx_game_company_links_company_id').on(t.companyId)
  ]
)

export const gameCharacterLinks = sqliteTable(
  'game_character_links',
  {
    ...baseColumns,
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    characterId: text('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    role: gameCharacterRole('role').notNull().default('other'),
    note: text('note'),
    orderInGame: integer('order_in_game').notNull().default(0),
    orderInCharacter: integer('order_in_character').notNull().default(0)
  },
  (t) => [
    unique().on(t.gameId, t.characterId, t.role),
    index('idx_game_character_links_game_id').on(t.gameId),
    index('idx_game_character_links_character_id').on(t.characterId)
  ]
)

export const animePersonLinks = sqliteTable(
  'anime_person_links',
  {
    ...baseColumns,
    animeId: text('anime_id')
      .notNull()
      .references(() => animes.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    personId: text('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    role: animePersonRole('role').notNull().default('other'),
    note: text('note'),
    orderInAnime: integer('order_in_anime').notNull().default(0),
    orderInPerson: integer('order_in_person').notNull().default(0)
  },
  (t) => [
    unique().on(t.animeId, t.personId, t.role),
    index('idx_anime_person_links_anime_id').on(t.animeId),
    index('idx_anime_person_links_person_id').on(t.personId)
  ]
)

export const animeCompanyLinks = sqliteTable(
  'anime_company_links',
  {
    ...baseColumns,
    animeId: text('anime_id')
      .notNull()
      .references(() => animes.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    role: animeCompanyRole('role').notNull().default('other'),
    note: text('note'),
    orderInAnime: integer('order_in_anime').notNull().default(0),
    orderInCompany: integer('order_in_company').notNull().default(0)
  },
  (t) => [
    unique().on(t.animeId, t.companyId, t.role),
    index('idx_anime_company_links_anime_id').on(t.animeId),
    index('idx_anime_company_links_company_id').on(t.companyId)
  ]
)

export const animeCharacterLinks = sqliteTable(
  'anime_character_links',
  {
    ...baseColumns,
    animeId: text('anime_id')
      .notNull()
      .references(() => animes.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    characterId: text('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    role: animeCharacterRole('role').notNull().default('other'),
    note: text('note'),
    orderInAnime: integer('order_in_anime').notNull().default(0),
    orderInCharacter: integer('order_in_character').notNull().default(0)
  },
  (t) => [
    unique().on(t.animeId, t.characterId, t.role),
    index('idx_anime_character_links_anime_id').on(t.animeId),
    index('idx_anime_character_links_character_id').on(t.characterId)
  ]
)

export const tvPersonLinks = sqliteTable(
  'tv_person_links',
  {
    ...baseColumns,
    tvId: text('tv_id')
      .notNull()
      .references(() => tvs.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    personId: text('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    role: tvPersonRole('role').notNull().default('other'),
    note: text('note'),
    orderInTv: integer('order_in_tv').notNull().default(0),
    orderInPerson: integer('order_in_person').notNull().default(0)
  },
  (t) => [
    unique().on(t.tvId, t.personId, t.role),
    index('idx_tv_person_links_tv_id').on(t.tvId),
    index('idx_tv_person_links_person_id').on(t.personId)
  ]
)

export const tvCompanyLinks = sqliteTable(
  'tv_company_links',
  {
    ...baseColumns,
    tvId: text('tv_id')
      .notNull()
      .references(() => tvs.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    role: tvCompanyRole('role').notNull().default('other'),
    note: text('note'),
    orderInTv: integer('order_in_tv').notNull().default(0),
    orderInCompany: integer('order_in_company').notNull().default(0)
  },
  (t) => [
    unique().on(t.tvId, t.companyId, t.role),
    index('idx_tv_company_links_tv_id').on(t.tvId),
    index('idx_tv_company_links_company_id').on(t.companyId)
  ]
)

export const tvCharacterLinks = sqliteTable(
  'tv_character_links',
  {
    ...baseColumns,
    tvId: text('tv_id')
      .notNull()
      .references(() => tvs.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    characterId: text('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    role: tvCharacterRole('role').notNull().default('other'),
    note: text('note'),
    orderInTv: integer('order_in_tv').notNull().default(0),
    orderInCharacter: integer('order_in_character').notNull().default(0)
  },
  (t) => [
    unique().on(t.tvId, t.characterId, t.role),
    index('idx_tv_character_links_tv_id').on(t.tvId),
    index('idx_tv_character_links_character_id').on(t.characterId)
  ]
)

export const moviePersonLinks = sqliteTable(
  'movie_person_links',
  {
    ...baseColumns,
    movieId: text('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    personId: text('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    role: moviePersonRole('role').notNull().default('other'),
    note: text('note'),
    orderInMovie: integer('order_in_movie').notNull().default(0),
    orderInPerson: integer('order_in_person').notNull().default(0)
  },
  (t) => [
    unique().on(t.movieId, t.personId, t.role),
    index('idx_movie_person_links_movie_id').on(t.movieId),
    index('idx_movie_person_links_person_id').on(t.personId)
  ]
)

export const movieCompanyLinks = sqliteTable(
  'movie_company_links',
  {
    ...baseColumns,
    movieId: text('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    role: movieCompanyRole('role').notNull().default('other'),
    note: text('note'),
    orderInMovie: integer('order_in_movie').notNull().default(0),
    orderInCompany: integer('order_in_company').notNull().default(0)
  },
  (t) => [
    unique().on(t.movieId, t.companyId, t.role),
    index('idx_movie_company_links_movie_id').on(t.movieId),
    index('idx_movie_company_links_company_id').on(t.companyId)
  ]
)

export const movieCharacterLinks = sqliteTable(
  'movie_character_links',
  {
    ...baseColumns,
    movieId: text('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    characterId: text('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    role: movieCharacterRole('role').notNull().default('other'),
    note: text('note'),
    orderInMovie: integer('order_in_movie').notNull().default(0),
    orderInCharacter: integer('order_in_character').notNull().default(0)
  },
  (t) => [
    unique().on(t.movieId, t.characterId, t.role),
    index('idx_movie_character_links_movie_id').on(t.movieId),
    index('idx_movie_character_links_character_id').on(t.characterId)
  ]
)

export const collectionGameLinks = sqliteTable(
  'collection_game_links',
  {
    ...baseColumns,
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    note: text('note'),
    orderInCollection: integer('order_in_collection').notNull().default(0)
  },
  (t) => [
    unique().on(t.collectionId, t.gameId),
    index('idx_collection_game_links_collection_id').on(t.collectionId),
    index('idx_collection_game_links_game_id').on(t.gameId)
  ]
)

export const collectionAnimeLinks = sqliteTable(
  'collection_anime_links',
  {
    ...baseColumns,
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    animeId: text('anime_id')
      .notNull()
      .references(() => animes.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    note: text('note'),
    orderInCollection: integer('order_in_collection').notNull().default(0)
  },
  (t) => [
    unique().on(t.collectionId, t.animeId),
    index('idx_collection_anime_links_collection_id').on(t.collectionId),
    index('idx_collection_anime_links_anime_id').on(t.animeId)
  ]
)

export const collectionTvLinks = sqliteTable(
  'collection_tv_links',
  {
    ...baseColumns,
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tvId: text('tv_id')
      .notNull()
      .references(() => tvs.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    note: text('note'),
    orderInCollection: integer('order_in_collection').notNull().default(0)
  },
  (t) => [
    unique().on(t.collectionId, t.tvId),
    index('idx_collection_tv_links_collection_id').on(t.collectionId),
    index('idx_collection_tv_links_tv_id').on(t.tvId)
  ]
)

export const collectionMovieLinks = sqliteTable(
  'collection_movie_links',
  {
    ...baseColumns,
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    movieId: text('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    note: text('note'),
    orderInCollection: integer('order_in_collection').notNull().default(0)
  },
  (t) => [
    unique().on(t.collectionId, t.movieId),
    index('idx_collection_movie_links_collection_id').on(t.collectionId),
    index('idx_collection_movie_links_movie_id').on(t.movieId)
  ]
)

export const collectionCharacterLinks = sqliteTable(
  'collection_character_links',
  {
    ...baseColumns,
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    characterId: text('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    note: text('note'),
    orderInCollection: integer('order_in_collection').notNull().default(0)
  },
  (t) => [
    unique().on(t.collectionId, t.characterId),
    index('idx_collection_character_links_collection_id').on(t.collectionId),
    index('idx_collection_character_links_character_id').on(t.characterId)
  ]
)

export const collectionPersonLinks = sqliteTable(
  'collection_person_links',
  {
    ...baseColumns,
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    personId: text('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    note: text('note'),
    orderInCollection: integer('order_in_collection').notNull().default(0)
  },
  (t) => [
    unique().on(t.collectionId, t.personId),
    index('idx_collection_person_links_collection_id').on(t.collectionId),
    index('idx_collection_person_links_person_id').on(t.personId)
  ]
)

export const collectionCompanyLinks = sqliteTable(
  'collection_company_links',
  {
    ...baseColumns,
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    note: text('note'),
    orderInCollection: integer('order_in_collection').notNull().default(0)
  },
  (t) => [
    unique().on(t.collectionId, t.companyId),
    index('idx_collection_company_links_collection_id').on(t.collectionId),
    index('idx_collection_company_links_company_id').on(t.companyId)
  ]
)

export const characterPersonLinks = sqliteTable(
  'character_person_links',
  {
    ...baseColumns,
    characterId: text('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    personId: text('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    role: characterPersonRole('role').notNull().default('other'),
    note: text('note'),
    orderInCharacter: integer('order_in_character').notNull().default(0),
    orderInPerson: integer('order_in_person').notNull().default(0)
  },
  (t) => [
    unique().on(t.characterId, t.personId, t.role),
    index('idx_character_person_links_character_id').on(t.characterId),
    index('idx_character_person_links_person_id').on(t.personId)
  ]
)

export type AnimePersonLink = InferSelectModel<typeof animePersonLinks>
export type NewAnimePersonLink = InferInsertModel<typeof animePersonLinks>
export type AnimeCompanyLink = InferSelectModel<typeof animeCompanyLinks>
export type NewAnimeCompanyLink = InferInsertModel<typeof animeCompanyLinks>
export type AnimeCharacterLink = InferSelectModel<typeof animeCharacterLinks>
export type NewAnimeCharacterLink = InferInsertModel<typeof animeCharacterLinks>
export type CollectionAnimeLink = InferSelectModel<typeof collectionAnimeLinks>
export type NewCollectionAnimeLink = InferInsertModel<typeof collectionAnimeLinks>
export type TvPersonLink = InferSelectModel<typeof tvPersonLinks>
export type NewTvPersonLink = InferInsertModel<typeof tvPersonLinks>
export type TvCompanyLink = InferSelectModel<typeof tvCompanyLinks>
export type NewTvCompanyLink = InferInsertModel<typeof tvCompanyLinks>
export type TvCharacterLink = InferSelectModel<typeof tvCharacterLinks>
export type NewTvCharacterLink = InferInsertModel<typeof tvCharacterLinks>
export type CollectionTvLink = InferSelectModel<typeof collectionTvLinks>
export type NewCollectionTvLink = InferInsertModel<typeof collectionTvLinks>
export type MoviePersonLink = InferSelectModel<typeof moviePersonLinks>
export type NewMoviePersonLink = InferInsertModel<typeof moviePersonLinks>
export type MovieCompanyLink = InferSelectModel<typeof movieCompanyLinks>
export type NewMovieCompanyLink = InferInsertModel<typeof movieCompanyLinks>
export type MovieCharacterLink = InferSelectModel<typeof movieCharacterLinks>
export type NewMovieCharacterLink = InferInsertModel<typeof movieCharacterLinks>
export type CollectionMovieLink = InferSelectModel<typeof collectionMovieLinks>
export type NewCollectionMovieLink = InferInsertModel<typeof collectionMovieLinks>
export type GamePersonLink = InferSelectModel<typeof gamePersonLinks>
export type NewGamePersonLink = InferInsertModel<typeof gamePersonLinks>
export type GameCompanyLink = InferSelectModel<typeof gameCompanyLinks>
export type NewGameCompanyLink = InferInsertModel<typeof gameCompanyLinks>
export type GameCharacterLink = InferSelectModel<typeof gameCharacterLinks>
export type NewGameCharacterLink = InferInsertModel<typeof gameCharacterLinks>
export type CollectionGameLink = InferSelectModel<typeof collectionGameLinks>
export type NewCollectionGameLink = InferInsertModel<typeof collectionGameLinks>
export type CollectionCharacterLink = InferSelectModel<typeof collectionCharacterLinks>
export type NewCollectionCharacterLink = InferInsertModel<typeof collectionCharacterLinks>
export type CollectionPersonLink = InferSelectModel<typeof collectionPersonLinks>
export type NewCollectionPersonLink = InferInsertModel<typeof collectionPersonLinks>
export type CollectionCompanyLink = InferSelectModel<typeof collectionCompanyLinks>
export type NewCollectionCompanyLink = InferInsertModel<typeof collectionCompanyLinks>
export type CharacterPersonLink = InferSelectModel<typeof characterPersonLinks>
export type NewCharacterPersonLink = InferInsertModel<typeof characterPersonLinks>
