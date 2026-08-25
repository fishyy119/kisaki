import { relations } from 'drizzle-orm'

import {
  collectionAnimeLinks,
  collectionCharacterLinks,
  collectionComicLinks,
  collectionCompanyLinks,
  collectionGameLinks,
  collectionNovelLinks,
  collectionPersonLinks,
  collections,
  scanners
} from '../tables'

export const collectionsRelations = relations(collections, ({ many }) => ({
  collectionGameLinks: many(collectionGameLinks),
  collectionAnimeLinks: many(collectionAnimeLinks),
  collectionComicLinks: many(collectionComicLinks),
  collectionNovelLinks: many(collectionNovelLinks),
  collectionCharacterLinks: many(collectionCharacterLinks),
  collectionPersonLinks: many(collectionPersonLinks),
  collectionCompanyLinks: many(collectionCompanyLinks),
  scanners: many(scanners)
}))
