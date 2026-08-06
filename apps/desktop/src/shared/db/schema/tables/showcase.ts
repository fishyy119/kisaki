import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import {
  allEntityType,
  baseColumns,
  filterState,
  sectionItemSize,
  sectionLayout,
  sectionOpenMode,
  sortDirection
} from '../../columns'

export const showcaseSections = sqliteTable(
  'showcase_sections',
  {
    ...baseColumns,
    name: text('name').notNull(),
    entityType: allEntityType('entity_type').notNull().default('game'),
    order: integer('order').notNull().default(0),
    isVisible: integer('is_visible', { mode: 'boolean' }).notNull().default(true),
    layout: sectionLayout('layout').notNull().default('horizontal'),
    itemSize: sectionItemSize('item_size').notNull().default('md'),
    openMode: sectionOpenMode('open_mode').notNull().default('page'),
    limit: integer('limit'),
    filter: filterState('filter').notNull().default({ match: 'all', conditions: [] }),
    sortField: text('sort_field').notNull().default('name'),
    sortDirection: sortDirection('sort_direction').notNull().default('asc')
  },
  (t) => [index('idx_showcase_sections_order').on(t.order)]
)

export type ShowcaseSection = InferSelectModel<typeof showcaseSections>
export type NewShowcaseSection = InferInsertModel<typeof showcaseSections>
