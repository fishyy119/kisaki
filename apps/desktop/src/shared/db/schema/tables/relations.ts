import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import { baseColumns, mediaRelationType, mediaType } from '../../columns'

/**
 * Directed entry-to-entry edges between media entries of any media type.
 *
 * Polymorphic endpoints cannot carry SQLite foreign keys, so referential
 * integrity is owned by the application choke points: entity delete clears
 * both ends and entity merge remaps them. Rows are written as scraped or
 * edited; readers merge both directions via the inverse vocabulary.
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

export type MediaRelation = InferSelectModel<typeof mediaRelations>
export type NewMediaRelation = InferInsertModel<typeof mediaRelations>
