import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import {
  animeCharacterRole,
  animeCompanyRole,
  animePersonRole,
  baseColumns,
  characterPersonRole,
  comicCharacterRole,
  comicCompanyRole,
  comicPersonRole,
  gameCharacterRole,
  gameCompanyRole,
  gamePersonRole,
  novelCharacterRole,
  novelCompanyRole,
  novelPersonRole
} from '../../columns'
import { collections } from './collections'
import { animes, characters, comics, companies, games, novels, persons } from './content'

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

export const comicPersonLinks = sqliteTable(
  'comic_person_links',
  {
    ...baseColumns,
    comicId: text('comic_id')
      .notNull()
      .references(() => comics.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    personId: text('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    role: comicPersonRole('role').notNull().default('other'),
    note: text('note'),
    orderInComic: integer('order_in_comic').notNull().default(0),
    orderInPerson: integer('order_in_person').notNull().default(0)
  },
  (t) => [
    unique().on(t.comicId, t.personId, t.role),
    index('idx_comic_person_links_comic_id').on(t.comicId),
    index('idx_comic_person_links_person_id').on(t.personId)
  ]
)

export const comicCompanyLinks = sqliteTable(
  'comic_company_links',
  {
    ...baseColumns,
    comicId: text('comic_id')
      .notNull()
      .references(() => comics.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    role: comicCompanyRole('role').notNull().default('other'),
    note: text('note'),
    orderInComic: integer('order_in_comic').notNull().default(0),
    orderInCompany: integer('order_in_company').notNull().default(0)
  },
  (t) => [
    unique().on(t.comicId, t.companyId, t.role),
    index('idx_comic_company_links_comic_id').on(t.comicId),
    index('idx_comic_company_links_company_id').on(t.companyId)
  ]
)

export const comicCharacterLinks = sqliteTable(
  'comic_character_links',
  {
    ...baseColumns,
    comicId: text('comic_id')
      .notNull()
      .references(() => comics.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    characterId: text('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    role: comicCharacterRole('role').notNull().default('other'),
    note: text('note'),
    orderInComic: integer('order_in_comic').notNull().default(0),
    orderInCharacter: integer('order_in_character').notNull().default(0)
  },
  (t) => [
    unique().on(t.comicId, t.characterId, t.role),
    index('idx_comic_character_links_comic_id').on(t.comicId),
    index('idx_comic_character_links_character_id').on(t.characterId)
  ]
)

export const novelPersonLinks = sqliteTable(
  'novel_person_links',
  {
    ...baseColumns,
    novelId: text('novel_id')
      .notNull()
      .references(() => novels.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    personId: text('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    role: novelPersonRole('role').notNull().default('other'),
    note: text('note'),
    orderInNovel: integer('order_in_novel').notNull().default(0),
    orderInPerson: integer('order_in_person').notNull().default(0)
  },
  (t) => [
    unique().on(t.novelId, t.personId, t.role),
    index('idx_novel_person_links_novel_id').on(t.novelId),
    index('idx_novel_person_links_person_id').on(t.personId)
  ]
)

export const novelCompanyLinks = sqliteTable(
  'novel_company_links',
  {
    ...baseColumns,
    novelId: text('novel_id')
      .notNull()
      .references(() => novels.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    role: novelCompanyRole('role').notNull().default('other'),
    note: text('note'),
    orderInNovel: integer('order_in_novel').notNull().default(0),
    orderInCompany: integer('order_in_company').notNull().default(0)
  },
  (t) => [
    unique().on(t.novelId, t.companyId, t.role),
    index('idx_novel_company_links_novel_id').on(t.novelId),
    index('idx_novel_company_links_company_id').on(t.companyId)
  ]
)

export const novelCharacterLinks = sqliteTable(
  'novel_character_links',
  {
    ...baseColumns,
    novelId: text('novel_id')
      .notNull()
      .references(() => novels.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    characterId: text('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    role: novelCharacterRole('role').notNull().default('other'),
    note: text('note'),
    orderInNovel: integer('order_in_novel').notNull().default(0),
    orderInCharacter: integer('order_in_character').notNull().default(0)
  },
  (t) => [
    unique().on(t.novelId, t.characterId, t.role),
    index('idx_novel_character_links_novel_id').on(t.novelId),
    index('idx_novel_character_links_character_id').on(t.characterId)
  ]
)

/**
 * A voice credit: which person voices which character in this entry.
 *
 * Casting is a three-way fact — sources issue it per work, and the same
 * character is voiced by different people across an adult original, its
 * all-ages adaptation, and its remakes — so it is stored whole rather than
 * split into binary edges that no join can put back together.
 *
 * The row carries no role, spoiler flag, or order of its own: being here is the
 * fact, the spoiler decision belongs to the character link, and display order
 * follows the character link's order.
 */
export const gameCastLinks = sqliteTable(
  'game_cast_links',
  {
    ...baseColumns,
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    characterId: text('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    personId: text('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    note: text('note')
  },
  (t) => [
    unique().on(t.gameId, t.characterId, t.personId),
    index('idx_game_cast_links_game_id').on(t.gameId),
    index('idx_game_cast_links_character_id').on(t.characterId),
    index('idx_game_cast_links_person_id').on(t.personId)
  ]
)

/** Voice credits of an anime entry; see `gameCastLinks` for the shape's rationale. */
export const animeCastLinks = sqliteTable(
  'anime_cast_links',
  {
    ...baseColumns,
    animeId: text('anime_id')
      .notNull()
      .references(() => animes.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    characterId: text('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    personId: text('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    note: text('note')
  },
  (t) => [
    unique().on(t.animeId, t.characterId, t.personId),
    index('idx_anime_cast_links_anime_id').on(t.animeId),
    index('idx_anime_cast_links_character_id').on(t.characterId),
    index('idx_anime_cast_links_person_id').on(t.personId)
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

export const collectionComicLinks = sqliteTable(
  'collection_comic_links',
  {
    ...baseColumns,
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    comicId: text('comic_id')
      .notNull()
      .references(() => comics.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    note: text('note'),
    orderInCollection: integer('order_in_collection').notNull().default(0)
  },
  (t) => [
    unique().on(t.collectionId, t.comicId),
    index('idx_collection_comic_links_collection_id').on(t.collectionId),
    index('idx_collection_comic_links_comic_id').on(t.comicId)
  ]
)

export const collectionNovelLinks = sqliteTable(
  'collection_novel_links',
  {
    ...baseColumns,
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    novelId: text('novel_id')
      .notNull()
      .references(() => novels.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    note: text('note'),
    orderInCollection: integer('order_in_collection').notNull().default(0)
  },
  (t) => [
    unique().on(t.collectionId, t.novelId),
    index('idx_collection_novel_links_collection_id').on(t.collectionId),
    index('idx_collection_novel_links_novel_id').on(t.novelId)
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

/**
 * What a person is to a character, independent of any one work: who voices
 * them, who draws them, who designed them.
 *
 * This is the knowledge layer, so it survives a work leaving the library and it
 * is written by merge only — one work's scrape proves a credit exists, never
 * that a missing one is wrong. Which credit applies inside a given entry is the
 * cast tables' answer, not this one's.
 */
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
export type AnimeCastLink = InferSelectModel<typeof animeCastLinks>
export type NewAnimeCastLink = InferInsertModel<typeof animeCastLinks>
export type CollectionAnimeLink = InferSelectModel<typeof collectionAnimeLinks>
export type NewCollectionAnimeLink = InferInsertModel<typeof collectionAnimeLinks>
export type GameCastLink = InferSelectModel<typeof gameCastLinks>
export type NewGameCastLink = InferInsertModel<typeof gameCastLinks>
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
export type ComicPersonLink = InferSelectModel<typeof comicPersonLinks>
export type NewComicPersonLink = InferInsertModel<typeof comicPersonLinks>
export type ComicCompanyLink = InferSelectModel<typeof comicCompanyLinks>
export type NewComicCompanyLink = InferInsertModel<typeof comicCompanyLinks>
export type ComicCharacterLink = InferSelectModel<typeof comicCharacterLinks>
export type NewComicCharacterLink = InferInsertModel<typeof comicCharacterLinks>
export type CollectionComicLink = InferSelectModel<typeof collectionComicLinks>
export type NewCollectionComicLink = InferInsertModel<typeof collectionComicLinks>
export type NovelPersonLink = InferSelectModel<typeof novelPersonLinks>
export type NewNovelPersonLink = InferInsertModel<typeof novelPersonLinks>
export type NovelCompanyLink = InferSelectModel<typeof novelCompanyLinks>
export type NewNovelCompanyLink = InferInsertModel<typeof novelCompanyLinks>
export type NovelCharacterLink = InferSelectModel<typeof novelCharacterLinks>
export type NewNovelCharacterLink = InferInsertModel<typeof novelCharacterLinks>
export type CollectionNovelLink = InferSelectModel<typeof collectionNovelLinks>
export type NewCollectionNovelLink = InferInsertModel<typeof collectionNovelLinks>
