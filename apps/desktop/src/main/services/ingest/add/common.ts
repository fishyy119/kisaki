import { normalizeExternalIds, type ExternalId } from '@shared/identity'
import type { ScraperLookup } from '@shared/scraper'
import { ScrapeFailure } from '@main/services/scraper'
import type { DbService } from '@main/services/db'
import {
  collectionAnimeLinks,
  collectionCharacterLinks,
  collectionCompanyLinks,
  collectionGameLinks,
  collectionPersonLinks
} from '@shared/db'

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

export function normalizeKnownIds(knownIds: ExternalId[] | undefined): ExternalId[] {
  return normalizeExternalIds(knownIds)
}

export function normalizeLookup<TLookup extends ScraperLookup>(lookup: TLookup): TLookup {
  const name = lookup.name?.trim()
  if (!name) {
    throw new Error('lookup.name is required')
  }

  const knownIds = normalizeKnownIds(lookup.knownIds)

  return {
    ...lookup,
    name,
    knownIds: knownIds.length > 0 ? knownIds : undefined
  }
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

export function addGameToCollection(
  dbService: DbService,
  gameId: string,
  targetCollectionId: string | undefined
): void {
  if (!targetCollectionId) return

  dbService.client
    .insert(collectionGameLinks)
    .values({
      collectionId: targetCollectionId,
      gameId,
      orderInCollection: 0
    })
    .onConflictDoNothing()
    .run()
}

export function addAnimeToCollection(
  dbService: DbService,
  animeId: string,
  targetCollectionId: string | undefined
): void {
  if (!targetCollectionId) return

  dbService.client
    .insert(collectionAnimeLinks)
    .values({
      collectionId: targetCollectionId,
      animeId,
      orderInCollection: 0
    })
    .onConflictDoNothing()
    .run()
}

export function addPersonToCollection(
  dbService: DbService,
  personId: string,
  targetCollectionId: string | undefined
): void {
  if (!targetCollectionId) return

  dbService.client
    .insert(collectionPersonLinks)
    .values({
      collectionId: targetCollectionId,
      personId,
      orderInCollection: 0
    })
    .onConflictDoNothing()
    .run()
}

export function addCompanyToCollection(
  dbService: DbService,
  companyId: string,
  targetCollectionId: string | undefined
): void {
  if (!targetCollectionId) return

  dbService.client
    .insert(collectionCompanyLinks)
    .values({
      collectionId: targetCollectionId,
      companyId,
      orderInCollection: 0
    })
    .onConflictDoNothing()
    .run()
}

export function addCharacterToCollection(
  dbService: DbService,
  characterId: string,
  targetCollectionId: string | undefined
): void {
  if (!targetCollectionId) return

  dbService.client
    .insert(collectionCharacterLinks)
    .values({
      collectionId: targetCollectionId,
      characterId,
      orderInCollection: 0
    })
    .onConflictDoNothing()
    .run()
}
