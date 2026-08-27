import { ScrapeFailure } from '@main/services/scraper'
import type { DbService } from '@main/services/db'
import type { ContentEntityType } from '@shared/common'
import {
  collectionAnimeLinks,
  collectionCharacterLinks,
  collectionComicLinks,
  collectionCompanyLinks,
  collectionGameLinks,
  collectionNovelLinks,
  collectionPersonLinks
} from '@shared/db'
import type { ScraperLookup } from '@shared/scraper'
import { normalizeLookup } from '../normalization'

export interface NormalizedIngestLookupInput<TLookup extends ScraperLookup> {
  profileId: string
  lookup: TLookup
}

export function normalizeProfileId(profileId: string): string {
  const normalized = profileId.trim()
  if (!normalized) {
    throw new Error('profileId is required')
  }
  return normalized
}

export function normalizeIngestLookupInput<TLookup extends ScraperLookup>(
  profileId: string,
  lookup: TLookup
): NormalizedIngestLookupInput<TLookup> {
  return {
    profileId: normalizeProfileId(profileId),
    lookup: normalizeLookup(lookup)
  }
}

export function requireScrapedBundle<T>(bundle: T | null, entityType: string): T {
  if (bundle) {
    return bundle
  }

  throw new ScrapeFailure(
    'metadata-missing',
    `Scraper returned no ${entityType} data for the requested lookup.`
  )
}

/** Membership insert per entity type; `addEntityToCollection` guards and runs them. */
const COLLECTION_LINK_INSERTS: Record<
  ContentEntityType,
  (client: DbService['client'], collectionId: string, entityId: string) => void
> = {
  game: (client, collectionId, entityId) => {
    client
      .insert(collectionGameLinks)
      .values({ collectionId, gameId: entityId, orderInCollection: 0 })
      .onConflictDoNothing()
      .run()
  },
  anime: (client, collectionId, entityId) => {
    client
      .insert(collectionAnimeLinks)
      .values({ collectionId, animeId: entityId, orderInCollection: 0 })
      .onConflictDoNothing()
      .run()
  },
  comic: (client, collectionId, entityId) => {
    client
      .insert(collectionComicLinks)
      .values({ collectionId, comicId: entityId, orderInCollection: 0 })
      .onConflictDoNothing()
      .run()
  },
  novel: (client, collectionId, entityId) => {
    client
      .insert(collectionNovelLinks)
      .values({ collectionId, novelId: entityId, orderInCollection: 0 })
      .onConflictDoNothing()
      .run()
  },
  person: (client, collectionId, entityId) => {
    client
      .insert(collectionPersonLinks)
      .values({ collectionId, personId: entityId, orderInCollection: 0 })
      .onConflictDoNothing()
      .run()
  },
  company: (client, collectionId, entityId) => {
    client
      .insert(collectionCompanyLinks)
      .values({ collectionId, companyId: entityId, orderInCollection: 0 })
      .onConflictDoNothing()
      .run()
  },
  character: (client, collectionId, entityId) => {
    client
      .insert(collectionCharacterLinks)
      .values({ collectionId, characterId: entityId, orderInCollection: 0 })
      .onConflictDoNothing()
      .run()
  }
}

/** Adds an entity to the requested collection; no target means nothing to do. */
export function addEntityToCollection(
  dbService: DbService,
  entityType: ContentEntityType,
  entityId: string,
  targetCollectionId: string | undefined
): void {
  if (!targetCollectionId) return
  COLLECTION_LINK_INSERTS[entityType](dbService.client, targetCollectionId, entityId)
}
