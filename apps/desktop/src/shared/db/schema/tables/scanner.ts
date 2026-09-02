import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import { baseColumns, mediaType, nameExtractionRules } from '../../columns'
import { collections } from './collections'
import { scraperProfiles } from './scraper'

export const scanners = sqliteTable(
  'scanners',
  {
    ...baseColumns,
    name: text('name').notNull(),
    path: text('path').notNull(),
    type: mediaType('type').notNull(),
    /** Optional scrape policy; a scanner without one ingests directly. */
    scraperProfileId: text('scraper_profile_id').references(() => scraperProfiles.id, {
      onDelete: 'set null',
      onUpdate: 'cascade'
    }),
    targetCollectionId: text('target_collection_id').references(() => collections.id, {
      onDelete: 'set null',
      onUpdate: 'cascade'
    }),
    /** Watch the scan path and scan when a new entity directory appears. */
    watchEnabled: integer('watch_enabled', { mode: 'boolean' }).notNull().default(true),
    entityDepth: integer('entity_depth').notNull().default(0),
    nameExtractionRules: nameExtractionRules('name_extraction_rules').notNull().default([])
  },
  (t) => [
    index('idx_scanners_type').on(t.type),
    index('idx_scanners_scraper_profile_id').on(t.scraperProfileId)
  ]
)

export type Scanner = InferSelectModel<typeof scanners>
export type NewScanner = InferInsertModel<typeof scanners>
