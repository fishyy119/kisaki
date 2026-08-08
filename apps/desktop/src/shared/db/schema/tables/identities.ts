import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import { baseColumns, identityKeyText } from '../../columns'
import { characters, companies, games, persons } from './content'

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
export type PersonExternalId = InferSelectModel<typeof personExternalIds>
export type NewPersonExternalId = InferInsertModel<typeof personExternalIds>
export type CompanyExternalId = InferSelectModel<typeof companyExternalIds>
export type NewCompanyExternalId = InferInsertModel<typeof companyExternalIds>
export type CharacterExternalId = InferSelectModel<typeof characterExternalIds>
export type NewCharacterExternalId = InferInsertModel<typeof characterExternalIds>
