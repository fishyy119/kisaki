import { relations } from 'drizzle-orm'

import { collections, scraperProfiles, scanners } from '../tables'

export const scraperProfilesRelations = relations(scraperProfiles, ({ many }) => ({
  scanners: many(scanners)
}))

export const scannersRelations = relations(scanners, ({ one }) => ({
  scraperProfile: one(scraperProfiles, {
    fields: [scanners.scraperProfileId],
    references: [scraperProfiles.id]
  }),
  targetCollection: one(collections, {
    fields: [scanners.targetCollectionId],
    references: [collections.id]
  })
}))
