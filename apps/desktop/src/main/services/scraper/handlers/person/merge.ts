import {
  PERSON_SCRAPER_SLOTS,
  type PersonScraperSlotConfigs,
  type ScraperProfile,
  type SlotStrategy
} from '@shared/db'
import type {
  ScrapedEntityIdentity,
  ScrapedPersonMetadata,
  ScrapedPersonBundle
} from '@shared/scraper'
import {
  applyImageStrategy,
  applyStrategy,
  filterBySlot,
  foldCollectionResults,
  mergeScrapedIdentities,
  sortByRank
} from '../../shared'
import type {
  PersonScraperImageResult,
  PersonScraperPhotosResult,
  PersonScraperInfoResult,
  PersonScraperResult,
  PersonScraperTagsResult
} from './types'

/**
 * Merge all provider results into a scraper fact bundle.
 */
export function mergePersonScraperBundle(
  results: PersonScraperResult[],
  profile: ScraperProfile,
  identities: readonly ScrapedEntityIdentity[] = []
): ScrapedPersonBundle | null {
  const metadata = mergePersonScraperMetadata(results, profile, identities)
  if (!metadata) return null
  return toScrapedPersonBundle(metadata)
}

/**
 * Merge all provider results into final ScrapedPersonMetadata.
 * Returns null if no valid name could be determined from any provider.
 */
export function mergePersonScraperMetadata(
  results: PersonScraperResult[],
  profile: ScraperProfile,
  identities: readonly ScrapedEntityIdentity[] = []
): ScrapedPersonMetadata | null {
  const metadata: Partial<ScrapedPersonMetadata> = {
    identity: mergeScrapedIdentities(...identities)
  }
  const slotConfigs = profile.slotConfigs as PersonScraperSlotConfigs

  for (const slot of PERSON_SCRAPER_SLOTS) {
    const config = slotConfigs[slot]
    const strategy = config.strategy

    switch (slot) {
      case 'info':
        mergeInfo(metadata, filterBySlot(results, 'info'), strategy)
        break
      case 'tags':
        mergeTags(metadata, filterBySlot(results, 'tags'), strategy)
        break
      case 'photos':
        mergePhotos(metadata, filterBySlot(results, 'photos'), strategy)
        break
    }
  }

  return finalize(metadata)
}

/**
 * Merge image results for picker dialogs.
 */
export function mergePersonScraperImages(
  results: PersonScraperImageResult[],
  strategy: SlotStrategy
): string[] {
  const sorted = sortByRank(results)
  const allImages: string[] = []

  for (const result of sorted) {
    if (!result.data.length) continue

    if (strategy === 'first') {
      return result.data
    }

    allImages.push(...result.data)
  }

  return [...new Set(allImages)]
}

function mergeInfo(
  metadata: Partial<ScrapedPersonMetadata>,
  results: PersonScraperInfoResult[],
  strategy: SlotStrategy
): void {
  const sorted = sortByRank(results)

  for (const result of sorted) {
    const info = result.data

    if (!metadata.name && info.name) metadata.name = info.name
    if (!metadata.originalName && info.originalName) metadata.originalName = info.originalName
    if (!metadata.birthDate && info.birthDate) metadata.birthDate = info.birthDate
    if (!metadata.deathDate && info.deathDate) metadata.deathDate = info.deathDate
    if (!metadata.gender && info.gender) metadata.gender = info.gender
    if (!metadata.description && info.description) metadata.description = info.description

    // Presence is authority: a provider that reports no sites at all keeps the
    // collection empty instead of leaving it unknown.
    if (info.externalSites) {
      metadata.externalSites = applyStrategy(
        metadata.externalSites,
        info.externalSites,
        strategy,
        (s) => s.url
      )
    }

    if (strategy === 'first') break
  }
}

function mergeTags(
  metadata: Partial<ScrapedPersonMetadata>,
  results: PersonScraperTagsResult[],
  strategy: SlotStrategy
): void {
  metadata.tags = foldCollectionResults(results, strategy, (merged, result) =>
    applyStrategy(merged, result.data, strategy, (t) => t.name)
  )
}

function mergePhotos(
  metadata: Partial<ScrapedPersonMetadata>,
  results: PersonScraperPhotosResult[],
  strategy: SlotStrategy
): void {
  metadata.photos = foldCollectionResults(results, strategy, (merged, result) =>
    applyImageStrategy(merged, result.data, strategy)
  )
}

function finalize(partial: Partial<ScrapedPersonMetadata>): ScrapedPersonMetadata | null {
  if (!partial.name) return null

  return {
    identity: partial.identity ?? mergeScrapedIdentities(),
    name: partial.name,
    originalName: partial.originalName,
    birthDate: partial.birthDate,
    deathDate: partial.deathDate,
    gender: partial.gender,
    description: partial.description,
    externalSites: partial.externalSites,
    tags: partial.tags,
    photos: partial.photos
  }
}

/**
 * Convert merged scraper metadata into a scraper fact bundle.
 */
export function toScrapedPersonBundle(metadata: ScrapedPersonMetadata): ScrapedPersonBundle {
  return {
    identity: metadata.identity,
    core: {
      name: metadata.name,
      originalName: metadata.originalName,
      birthDate: metadata.birthDate,
      deathDate: metadata.deathDate,
      gender: metadata.gender,
      description: metadata.description,
      externalSites: metadata.externalSites,
      tags: metadata.tags
    },
    // Slot presence, not slot content: an empty array is an authoritative
    // "no photos", a missing key is "unknown".
    mediaCandidates: metadata.photos ? { photoUrls: metadata.photos } : undefined
  }
}
