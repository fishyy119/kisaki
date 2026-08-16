import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import { baseColumns, identityKeyText } from '../../columns'
import { animes, characters, companies, movies, persons, games, tvs } from './content'

export const tags = sqliteTable(
  'tags',
  {
    ...baseColumns,
    name: text('name').notNull().unique(),
    /**
     * The tag's matching identity, written as the display name and normalized by
     * the column. Kept as an indexed column because that normalization (NFKC +
     * case folding) cannot be pushed into SQL. Deliberately not unique: existing
     * rows may normalize to the same key, and dedup is a merge decision rather
     * than a write constraint.
     */
    normalizedName: identityKeyText('normalized_name').notNull().default(''),
    description: text('description'),
    isNsfw: integer('is_nsfw', { mode: 'boolean' }).notNull().default(false)
  },
  (t) => [
    index('idx_tags_name').on(t.name),
    index('idx_tags_normalized_name').on(t.normalizedName),
    index('idx_tags_is_nsfw').on(t.isNsfw)
  ]
)

export const gameTagLinks = sqliteTable(
  'game_tag_links',
  {
    ...baseColumns,
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    note: text('note'),
    orderInGame: integer('order_in_game').notNull().default(0),
    orderInTag: integer('order_in_tag').notNull().default(0)
  },
  (t) => [
    unique().on(t.gameId, t.tagId),
    index('idx_game_tag_links_game_id').on(t.gameId),
    index('idx_game_tag_links_tag_id').on(t.tagId)
  ]
)

export const animeTagLinks = sqliteTable(
  'anime_tag_links',
  {
    ...baseColumns,
    animeId: text('anime_id')
      .notNull()
      .references(() => animes.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    note: text('note'),
    orderInAnime: integer('order_in_anime').notNull().default(0),
    orderInTag: integer('order_in_tag').notNull().default(0)
  },
  (t) => [
    unique().on(t.animeId, t.tagId),
    index('idx_anime_tag_links_anime_id').on(t.animeId),
    index('idx_anime_tag_links_tag_id').on(t.tagId)
  ]
)

export const tvTagLinks = sqliteTable(
  'tv_tag_links',
  {
    ...baseColumns,
    tvId: text('tv_id')
      .notNull()
      .references(() => tvs.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    note: text('note'),
    orderInTv: integer('order_in_tv').notNull().default(0),
    orderInTag: integer('order_in_tag').notNull().default(0)
  },
  (t) => [
    unique().on(t.tvId, t.tagId),
    index('idx_tv_tag_links_tv_id').on(t.tvId),
    index('idx_tv_tag_links_tag_id').on(t.tagId)
  ]
)

export const movieTagLinks = sqliteTable(
  'movie_tag_links',
  {
    ...baseColumns,
    movieId: text('movie_id')
      .notNull()
      .references(() => movies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    note: text('note'),
    orderInMovie: integer('order_in_movie').notNull().default(0),
    orderInTag: integer('order_in_tag').notNull().default(0)
  },
  (t) => [
    unique().on(t.movieId, t.tagId),
    index('idx_movie_tag_links_movie_id').on(t.movieId),
    index('idx_movie_tag_links_tag_id').on(t.tagId)
  ]
)

export const characterTagLinks = sqliteTable(
  'character_tag_links',
  {
    ...baseColumns,
    characterId: text('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    note: text('note'),
    orderInCharacter: integer('order_in_character').notNull().default(0),
    orderInTag: integer('order_in_tag').notNull().default(0)
  },
  (t) => [
    unique().on(t.characterId, t.tagId),
    index('idx_character_tag_links_character_id').on(t.characterId),
    index('idx_character_tag_links_tag_id').on(t.tagId)
  ]
)

export const personTagLinks = sqliteTable(
  'person_tag_links',
  {
    ...baseColumns,
    personId: text('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    note: text('note'),
    orderInPerson: integer('order_in_person').notNull().default(0),
    orderInTag: integer('order_in_tag').notNull().default(0)
  },
  (t) => [
    unique().on(t.personId, t.tagId),
    index('idx_person_tag_links_person_id').on(t.personId),
    index('idx_person_tag_links_tag_id').on(t.tagId)
  ]
)

export const companyTagLinks = sqliteTable(
  'company_tag_links',
  {
    ...baseColumns,
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    note: text('note'),
    orderInCompany: integer('order_in_company').notNull().default(0),
    orderInTag: integer('order_in_tag').notNull().default(0)
  },
  (t) => [
    unique().on(t.companyId, t.tagId),
    index('idx_company_tag_links_company_id').on(t.companyId),
    index('idx_company_tag_links_tag_id').on(t.tagId)
  ]
)

export type Tag = InferSelectModel<typeof tags>
export type NewTag = InferInsertModel<typeof tags>
export type GameTagLink = InferSelectModel<typeof gameTagLinks>
export type NewGameTagLink = InferInsertModel<typeof gameTagLinks>
export type AnimeTagLink = InferSelectModel<typeof animeTagLinks>
export type NewAnimeTagLink = InferInsertModel<typeof animeTagLinks>
export type TvTagLink = InferSelectModel<typeof tvTagLinks>
export type NewTvTagLink = InferInsertModel<typeof tvTagLinks>
export type MovieTagLink = InferSelectModel<typeof movieTagLinks>
export type NewMovieTagLink = InferInsertModel<typeof movieTagLinks>
export type CharacterTagLink = InferSelectModel<typeof characterTagLinks>
export type NewCharacterTagLink = InferInsertModel<typeof characterTagLinks>
export type PersonTagLink = InferSelectModel<typeof personTagLinks>
export type NewPersonTagLink = InferInsertModel<typeof personTagLinks>
export type CompanyTagLink = InferSelectModel<typeof companyTagLinks>
export type NewCompanyTagLink = InferInsertModel<typeof companyTagLinks>
