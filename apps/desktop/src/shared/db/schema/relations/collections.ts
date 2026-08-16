import { relations } from 'drizzle-orm'

import {
  collectionAnimeLinks,
  collectionCharacterLinks,
  collectionCompanyLinks,
  collectionGameLinks,
  collectionMovieLinks,
  collectionPersonLinks,
  collections,
  collectionTvLinks,
  scanners
} from '../tables'

export const collectionsRelations = relations(collections, ({ many }) => ({
  collectionGameLinks: many(collectionGameLinks),
  collectionAnimeLinks: many(collectionAnimeLinks),
  collectionTvLinks: many(collectionTvLinks),
  collectionMovieLinks: many(collectionMovieLinks),
  collectionCharacterLinks: many(collectionCharacterLinks),
  collectionPersonLinks: many(collectionPersonLinks),
  collectionCompanyLinks: many(collectionCompanyLinks),
  scanners: many(scanners)
}))
