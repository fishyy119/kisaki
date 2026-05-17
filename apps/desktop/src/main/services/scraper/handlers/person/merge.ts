import {
  PERSON_SCRAPER_SLOTS,
  type PersonScraperSlotConfigs,
  type ScraperProfile,
  type SlotStrategy
} from '@shared/db'
import { normalizeExternalIds, toExternalIdKey } from '@shared/identity'
import type { ScrapedPersonMetadata, ScrapedPersonBundle } from '@shared/scraper'
import { applyImageStrategy, applyStrategy, filterBySlot, sortByRank } from '../../shared'
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
  profile: ScraperProfile
): ScrapedPersonBundle | null {
  const metadata = mergePersonScraperMetadata(results, profile)
  if (!metadata) return null
  return toScrapedPersonBundle(metadata)
}

/**
 * Merge all provider results into final ScrapedPersonMetadata.
 * Returns null if no valid name could be determined from any provider.
 */
export function mergePersonScraperMetadata(
  results: PersonScraperResult[],
  profile: ScraperProfile
): ScrapedPersonMetadata | null {
  const metadata: Partial<ScrapedPersonMetadata> = {}
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

    if (info.relatedSites?.length) {
      metadata.relatedSites = applyStrategy(
        metadata.relatedSites,
        info.relatedSites,
        strategy,
        (s) => s.url
      )
    }

    if (info.externalIds?.length) {
      metadata.externalIds = normalizeExternalIds(
        applyStrategy(metadata.externalIds, info.externalIds, strategy, toExternalIdKey)
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
  const sorted = sortByRank(results)

  for (const result of sorted) {
    if (!result.data.length) continue
    metadata.tags = applyStrategy(metadata.tags, result.data, strategy, (t) => t.name)
    if (strategy === 'first' && metadata.tags?.length) break
  }
}

function mergePhotos(
  metadata: Partial<ScrapedPersonMetadata>,
  results: PersonScraperPhotosResult[],
  strategy: SlotStrategy
): void {
  const sorted = sortByRank(results)

  for (const result of sorted) {
    if (!result.data.length) continue
    metadata.photos = applyImageStrategy(metadata.photos, result.data, strategy)
    if (strategy === 'first' && metadata.photos?.length) break
  }
}

function finalize(partial: Partial<ScrapedPersonMetadata>): ScrapedPersonMetadata | null {
  if (!partial.name) return null

  return {
    name: partial.name,
    originalName: partial.originalName,
    birthDate: partial.birthDate,
    deathDate: partial.deathDate,
    gender: partial.gender,
    description: partial.description ?? '',
    relatedSites: partial.relatedSites ?? [],
    externalIds: partial.externalIds ?? [],
    tags: partial.tags,
    photos: partial.photos
  }
}

/**
 * Convert merged scraper metadata into a scraper fact bundle.
 */
export function toScrapedPersonBundle(metadata: ScrapedPersonMetadata): ScrapedPersonBundle {
  return {
    core: {
      name: metadata.name,
      originalName: metadata.originalName,
      birthDate: metadata.birthDate,
      deathDate: metadata.deathDate,
      gender: metadata.gender,
      description: metadata.description,
      relatedSites: metadata.relatedSites,
      externalIds: metadata.externalIds,
      tags: metadata.tags
    },
    mediaCandidates: metadata.photos?.length
      ? {
          photoUrls: metadata.photos
        }
      : undefined
  }
}
