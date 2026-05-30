import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import {
  baseColumns,
  characterPersonType,
  gameCharacterType,
  gameCompanyType,
  gamePersonType
} from '../../columns'
import { collections } from './collections'
import { characters, companies, games, persons } from './content'

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
    type: gamePersonType('type').notNull().default('other'),
    note: text('note'),
    orderInGame: integer('order_in_game').notNull().default(0),
    orderInPerson: integer('order_in_person').notNull().default(0)
  },
  (t) => [
    unique().on(t.gameId, t.personId, t.type),
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
    type: gameCompanyType('type').notNull().default('other'),
    note: text('note'),
    orderInGame: integer('order_in_game').notNull().default(0),
    orderInCompany: integer('order_in_company').notNull().default(0)
  },
  (t) => [
    unique().on(t.gameId, t.companyId, t.type),
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
    type: gameCharacterType('type').notNull().default('other'),
    note: text('note'),
    orderInGame: integer('order_in_game').notNull().default(0),
    orderInCharacter: integer('order_in_character').notNull().default(0)
  },
  (t) => [
    unique().on(t.gameId, t.characterId, t.type),
    index('idx_game_character_links_game_id').on(t.gameId),
    index('idx_game_character_links_character_id').on(t.characterId)
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
    type: characterPersonType('type').notNull().default('other'),
    note: text('note'),
    orderInCharacter: integer('order_in_character').notNull().default(0),
    orderInPerson: integer('order_in_person').notNull().default(0)
  },
  (t) => [
    unique('unique_character_person').on(t.characterId, t.personId, t.type),
    index('idx_character_person_links_character_id').on(t.characterId),
    index('idx_character_person_links_person_id').on(t.personId)
  ]
)

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
