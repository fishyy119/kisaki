import { relations } from 'drizzle-orm'

import {
  collectionCharacterLinks,
  collectionCompanyLinks,
  collectionGameLinks,
  collectionPersonLinks,
  collections,
  scanners
} from '../tables'

export const collectionsRelations = relations(collections, ({ many }) => ({
  collectionGameLinks: many(collectionGameLinks),
  collectionCharacterLinks: many(collectionCharacterLinks),
  collectionPersonLinks: many(collectionPersonLinks),
  collectionCompanyLinks: many(collectionCompanyLinks),
  scanners: many(scanners)
}))
