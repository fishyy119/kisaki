import {
  COMPANY_SCRAPER_SLOTS,
  type CompanyScraperSlotConfigs,
  type ScraperProfile,
  type SlotStrategy
} from '@shared/db'
import { normalizeExternalIds, toExternalIdKey } from '@shared/identity'
import type { ScrapedCompanyMetadata, ScrapedCompanyBundle } from '@shared/scraper'
import { applyImageStrategy, applyStrategy, filterBySlot, sortByRank } from '../../utils'
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
  profile: ScraperProfile
): ScrapedCompanyBundle | null {
  const metadata = mergeCompanyScraperMetadata(results, profile)
  if (!metadata) return null
  return toScrapedCompanyBundle(metadata)
}

/**
 * Merge all provider results into final ScrapedCompanyMetadata.
 * Returns null if no valid name could be determined from any provider.
 */
export function mergeCompanyScraperMetadata(
  results: CompanyScraperResult[],
  profile: ScraperProfile
): ScrapedCompanyMetadata | null {
  const metadata: Partial<ScrapedCompanyMetadata> = {}
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
  metadata: Partial<ScrapedCompanyMetadata>,
  results: CompanyScraperTagsResult[],
  strategy: SlotStrategy
): void {
  const sorted = sortByRank(results)

  for (const result of sorted) {
    if (!result.data.length) continue
    metadata.tags = applyStrategy(metadata.tags, result.data, strategy, (t) => t.name)
    if (strategy === 'first' && metadata.tags?.length) break
  }
}

function mergeLogos(
  metadata: Partial<ScrapedCompanyMetadata>,
  results: CompanyScraperLogosResult[],
  strategy: SlotStrategy
): void {
  const sorted = sortByRank(results)

  for (const result of sorted) {
    if (!result.data.length) continue
    metadata.logos = applyImageStrategy(metadata.logos, result.data, strategy)
    if (strategy === 'first' && metadata.logos?.length) break
  }
}

function finalize(partial: Partial<ScrapedCompanyMetadata>): ScrapedCompanyMetadata | null {
  if (!partial.name) return null

  return {
    name: partial.name,
    originalName: partial.originalName,
    foundedDate: partial.foundedDate,
    description: partial.description ?? '',
    relatedSites: partial.relatedSites ?? [],
    externalIds: partial.externalIds ?? [],
    tags: partial.tags,
    logos: partial.logos
  }
}

/**
 * Convert merged scraper metadata into a scraper fact bundle.
 */
export function toScrapedCompanyBundle(metadata: ScrapedCompanyMetadata): ScrapedCompanyBundle {
  return {
    core: {
      name: metadata.name,
      originalName: metadata.originalName,
      foundedDate: metadata.foundedDate,
      description: metadata.description,
      relatedSites: metadata.relatedSites,
      externalIds: metadata.externalIds,
      tags: metadata.tags
    },
    mediaCandidates: metadata.logos?.length
      ? {
          logoUrls: metadata.logos
        }
      : undefined
  }
}
