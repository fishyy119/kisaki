import {
  COMPANY_SCRAPER_SLOTS,
  type CompanyScraperSlotConfigs,
  type ScraperProfile,
  type SlotStrategy
} from '@shared/db'
import type {
  ScrapedCompanyMetadata,
  ScrapedCompanyBundle,
  ScrapedEntityIdentity
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
  CompanyScraperImageResult,
  CompanyScraperInfoResult,
  CompanyScraperLogosResult,
  CompanyScraperResult,
  CompanyScraperTagsResult
} from './types'

/**
 * Merge all provider results into a scraper fact bundle.
 */
export function mergeCompanyScraperBundle(
  results: CompanyScraperResult[],
  profile: ScraperProfile,
  identities: readonly ScrapedEntityIdentity[] = []
): ScrapedCompanyBundle | null {
  const metadata = mergeCompanyScraperMetadata(results, profile, identities)
  if (!metadata) return null
  return toScrapedCompanyBundle(metadata)
}

/**
 * Merge all provider results into final ScrapedCompanyMetadata.
 * Returns null if no valid name could be determined from any provider.
 */
export function mergeCompanyScraperMetadata(
  results: CompanyScraperResult[],
  profile: ScraperProfile,
  identities: readonly ScrapedEntityIdentity[] = []
): ScrapedCompanyMetadata | null {
  const metadata: Partial<ScrapedCompanyMetadata> = {
    identity: mergeScrapedIdentities(...identities)
  }
  const slotConfigs = profile.slotConfigs as CompanyScraperSlotConfigs

  for (const slot of COMPANY_SCRAPER_SLOTS) {
    const config = slotConfigs[slot]
    const strategy = config.strategy

    switch (slot) {
      case 'info':
        mergeInfo(metadata, filterBySlot(results, 'info'), strategy)
        break
      case 'tags':
        mergeTags(metadata, filterBySlot(results, 'tags'), strategy)
        break
      case 'logos':
        mergeLogos(metadata, filterBySlot(results, 'logos'), strategy)
        break
    }
  }

  return finalize(metadata)
}

/**
 * Merge image results for picker dialogs.
 */
export function mergeCompanyScraperImages(
  results: CompanyScraperImageResult[],
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
  metadata: Partial<ScrapedCompanyMetadata>,
  results: CompanyScraperInfoResult[],
  strategy: SlotStrategy
): void {
  const sorted = sortByRank(results)

  for (const result of sorted) {
    const info = result.data

    if (!metadata.name && info.name) metadata.name = info.name
    if (!metadata.originalName && info.originalName) metadata.originalName = info.originalName
    if (!metadata.foundedDate && info.foundedDate) metadata.foundedDate = info.foundedDate
    if (!metadata.description && info.description) metadata.description = info.description

    // Presence is authority: a provider that reports no sites at all keeps the
    // collection empty instead of leaving it unknown.
    if (info.relatedSites) {
      metadata.relatedSites = applyStrategy(
        metadata.relatedSites,
        info.relatedSites,
        strategy,
        (s) => s.url
      )
    }

    if (strategy === 'first') break
  }
}

function mergeTags(
  metadata: Partial<ScrapedCompanyMetadata>,
  results: CompanyScraperTagsResult[],
  strategy: SlotStrategy
): void {
  metadata.tags = foldCollectionResults(results, strategy, (merged, result) =>
    applyStrategy(merged, result.data, strategy, (t) => t.name)
  )
}

function mergeLogos(
  metadata: Partial<ScrapedCompanyMetadata>,
  results: CompanyScraperLogosResult[],
  strategy: SlotStrategy
): void {
  metadata.logos = foldCollectionResults(results, strategy, (merged, result) =>
    applyImageStrategy(merged, result.data, strategy)
  )
}

function finalize(partial: Partial<ScrapedCompanyMetadata>): ScrapedCompanyMetadata | null {
  if (!partial.name) return null

  return {
    identity: partial.identity ?? mergeScrapedIdentities(),
    name: partial.name,
    originalName: partial.originalName,
    foundedDate: partial.foundedDate,
    description: partial.description,
    relatedSites: partial.relatedSites,
    tags: partial.tags,
    logos: partial.logos
  }
}

/**
 * Convert merged scraper metadata into a scraper fact bundle.
 */
export function toScrapedCompanyBundle(metadata: ScrapedCompanyMetadata): ScrapedCompanyBundle {
  return {
    identity: metadata.identity,
    core: {
      name: metadata.name,
      originalName: metadata.originalName,
      foundedDate: metadata.foundedDate,
      description: metadata.description,
      relatedSites: metadata.relatedSites,
      tags: metadata.tags
    },
    // Slot presence, not slot content: an empty array is an authoritative
    // "no logos", a missing key is "unknown".
    mediaCandidates: metadata.logos ? { logoUrls: metadata.logos } : undefined
  }
}
