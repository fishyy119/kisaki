import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import { baseColumns, companyRelationType, mediaRelationType, mediaType } from '../../columns'
import { companies } from './content'

/**
 * Directed entry-to-entry edges between media entries of any media type.
 *
 * Polymorphic endpoints cannot carry SQLite foreign keys, so referential
 * integrity is owned by the application choke points: entity delete clears
 * both ends and entity merge remaps them. A row is the `from` entry's own
 * assertion, written as scraped or edited; readers merge both directions
 * through the inverse vocabulary and collapse kinds a more specific edge on
 * the same pair subsumes. The unique key therefore identifies an assertion,
 * not a fact: both endpoints may assert the same relation.
 */
export const mediaRelations = sqliteTable(
  'media_relations',
  {
    ...baseColumns,
    fromType: mediaType('from_type').notNull(),
    fromId: text('from_id').notNull(),
    toType: mediaType('to_type').notNull(),
    toId: text('to_id').notNull(),
    type: mediaRelationType('type').notNull().default('other'),
    note: text('note'),
    orderInFrom: integer('order_in_from').notNull().default(0)
  },
  (t) => [
    unique().on(t.fromType, t.fromId, t.toType, t.toId, t.type),
    index('idx_media_relations_from').on(t.fromType, t.fromId),
    index('idx_media_relations_to').on(t.toType, t.toId)
  ]
)

/**
 * Directed edges between companies: houses, labels, renames, and spin-offs.
 *
 * Both endpoints are one type, so unlike `media_relations` these are real
 * foreign keys and the database owns referential integrity. Reads merge both
 * directions through the inverse vocabulary, as media relations do.
 */
export const companyRelations = sqliteTable(
  'company_relations',
  {
    ...baseColumns,
    fromId: text('from_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    toId: text('to_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    type: companyRelationType('type').notNull().default('other'),
    note: text('note'),
    orderInFrom: integer('order_in_from').notNull().default(0)
  },
  (t) => [
    unique().on(t.fromId, t.toId, t.type),
    index('idx_company_relations_from').on(t.fromId),
    index('idx_company_relations_to').on(t.toId)
  ]
)

export type MediaRelation = InferSelectModel<typeof mediaRelations>
export type NewMediaRelation = InferInsertModel<typeof mediaRelations>
export type CompanyRelation = InferSelectModel<typeof companyRelations>
export type NewCompanyRelation = InferInsertModel<typeof companyRelations>
