import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import { baseColumns, dynamicCollectionConfig } from '../../columns'

export const collections = sqliteTable(
  'collections',
  {
    ...baseColumns,
    name: text('name').notNull().default('unknown collection'),
    description: text('description'),
    coverFile: text('cover_file'),
    isNsfw: integer('is_nsfw', { mode: 'boolean' }).notNull().default(false),
    order: integer('order').notNull().default(0),
    isDynamic: integer('is_dynamic', { mode: 'boolean' }).notNull().default(false),
    dynamicConfig: dynamicCollectionConfig('dynamic_config')
  },
  (t) => [
    index('idx_collections_order').on(t.order),
    index('idx_collections_name').on(t.name),
    index('idx_collections_is_dynamic').on(t.isDynamic)
  ]
)

export type Collection = InferSelectModel<typeof collections>
export type NewCollection = InferInsertModel<typeof collections>
