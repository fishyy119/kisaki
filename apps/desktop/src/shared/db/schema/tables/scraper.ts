import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import { baseColumns, contentEntityType, contentLocale, scraperSlotConfigs } from '../../columns'

export const scraperProfiles = sqliteTable(
  'scraper_profiles',
  {
    ...baseColumns,
    name: text('name').notNull(),
    description: text('description'),
    /** The content entity type this profile scrapes; satellites have profiles too. */
    entityType: contentEntityType('entity_type').notNull().default('game'),
    /** Recipe this profile was created from; null for provider or blank creations. */
    recipeId: text('recipe_id'),
    /**
     * Recommendation fingerprint the user chose to ignore; update suggestions
     * stay hidden until the recommendation changes again.
     */
    dismissedRecipeFingerprint: text('dismissed_recipe_fingerprint'),
    defaultLocale: contentLocale('default_locale'),
    searchProviderId: text('search_provider_id').notNull(),
    slotConfigs: scraperSlotConfigs('slot_configs').notNull(),
    order: integer('order').notNull().default(0)
  },
  (t) => [
    index('idx_scraper_profiles_entity_type').on(t.entityType),
    index('idx_scraper_profiles_order').on(t.order)
  ]
)

export type ScraperProfile = InferSelectModel<typeof scraperProfiles>
export type NewScraperProfile = InferInsertModel<typeof scraperProfiles>
