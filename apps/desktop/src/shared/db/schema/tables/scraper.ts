import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import {
  baseColumns,
  contentEntityType,
  contentLocale,
  mediaType,
  nameExtractionRules,
  scraperSlotConfigs
} from '../../columns'
import { collections } from './collections'

export const scraperProfiles = sqliteTable(
  'scraper_profiles',
  {
    ...baseColumns,
    name: text('name').notNull(),
    description: text('description'),
    mediaType: contentEntityType('media_type').notNull().default('game'),
    sourcePresetId: text('source_preset_id'),
    defaultLocale: contentLocale('default_locale'),
    searchProviderId: text('search_provider_id').notNull(),
    slotConfigs: scraperSlotConfigs('slot_configs').notNull(),
    order: integer('order').notNull().default(0)
  },
  (t) => [
    index('idx_scraper_profiles_media_type').on(t.mediaType),
    index('idx_scraper_profiles_order').on(t.order)
  ]
)

export type ScraperProfile = InferSelectModel<typeof scraperProfiles>
export type NewScraperProfile = InferInsertModel<typeof scraperProfiles>

export const scanners = sqliteTable(
  'scanners',
  {
    ...baseColumns,
    name: text('name').notNull().default('unknown scanner'),
    path: text('path').notNull(),
    type: mediaType('type').notNull(),
    scraperProfileId: text('scraper_profile_id')
      .notNull()
      .references(() => scraperProfiles.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
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
