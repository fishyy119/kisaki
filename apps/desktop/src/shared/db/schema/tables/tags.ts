import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import { baseColumns } from '../../columns'
import { characters, companies, persons, games } from './content'

export const tags = sqliteTable(
  'tags',
  {
    ...baseColumns,
    name: text('name').notNull().unique(),
    description: text('description'),
    isNsfw: integer('is_nsfw', { mode: 'boolean' }).notNull().default(false)
  },
  (t) => [index('idx_tags_name').on(t.name), index('idx_tags_is_nsfw').on(t.isNsfw)]
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
export type CharacterTagLink = InferSelectModel<typeof characterTagLinks>
export type NewCharacterTagLink = InferInsertModel<typeof characterTagLinks>
export type PersonTagLink = InferSelectModel<typeof personTagLinks>
export type NewPersonTagLink = InferInsertModel<typeof personTagLinks>
export type CompanyTagLink = InferSelectModel<typeof companyTagLinks>
export type NewCompanyTagLink = InferInsertModel<typeof companyTagLinks>
