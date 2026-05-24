import {
  CHARACTER_SCRAPER_SLOTS,
  type CharacterScraperSlotConfigs,
  type ScraperProfile,
  type SlotStrategy
} from '@shared/db'
import type {
  ScrapedCharacterMetadata,
  ScrapedCharacterBundle,
  ScrapedEntityIdentity
} from '@shared/scraper'
import {
  applyImageStrategy,
  applyStrategy,
  filterBySlot,
  mergeCharacterPersons,
  mergeScrapedIdentities,
  sortByRank,
  type RelationCollectionMergeOptions
} from '../../shared'
import type {
  CharacterScraperImageResult,
  CharacterScraperPhotosResult,
  CharacterScraperInfoResult,
  CharacterScraperPersonsResult,
  CharacterScraperResult,
  CharacterScraperTagsResult
} from './types'

/**
 * Merge all provider results into a scraper fact bundle.
 */
export function mergeCharacterScraperBundle(
  results: CharacterScraperResult[],
  profile: ScraperProfile,
  identities: readonly ScrapedEntityIdentity[] = []
): ScrapedCharacterBundle | null {
  const metadata = mergeCharacterScraperMetadata(results, profile, identities)
  if (!metadata) return null
  return toScrapedCharacterBundle(metadata)
}

/**
 * Merge all provider results into final ScrapedCharacterMetadata.
 * Returns null if no valid name could be determined from any provider.
 */
export function mergeCharacterScraperMetadata(
  results: CharacterScraperResult[],
  profile: ScraperProfile,
  identities: readonly ScrapedEntityIdentity[] = []
): ScrapedCharacterMetadata | null {
  const metadata: Partial<ScrapedCharacterMetadata> = {
    identity: mergeScrapedIdentities(...identities)
  }
  const slotConfigs = profile.slotConfigs as CharacterScraperSlotConfigs

  for (const slot of CHARACTER_SCRAPER_SLOTS) {
    switch (slot) {
      case 'info':
        mergeInfo(metadata, filterBySlot(results, 'info'), slotConfigs.info.strategy)
        break
      case 'tags':
        mergeTags(metadata, filterBySlot(results, 'tags'), slotConfigs.tags.strategy)
        break
      case 'persons':
        mergePersons(metadata, filterBySlot(results, 'persons'), {
          strategy: slotConfigs.persons.strategy,
          unmatchedEntityPolicy: slotConfigs.persons.unmatchedEntityPolicy
        })
        break
      case 'photos':
        mergePhotos(metadata, filterBySlot(results, 'photos'), slotConfigs.photos.strategy)
        break
    }
  }

  return finalize(metadata)
}

/**
 * Merge image results for picker dialogs.
 */
export function mergeCharacterScraperImages(
  results: CharacterScraperImageResult[],
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
  metadata: Partial<ScrapedCharacterMetadata>,
  results: CharacterScraperInfoResult[],
  strategy: SlotStrategy
): void {
  const sorted = sortByRank(results)

  for (const result of sorted) {
    const info = result.data

    if (!metadata.name && info.name) metadata.name = info.name
    if (!metadata.originalName && info.originalName) metadata.originalName = info.originalName
    if (!metadata.birthDate && info.birthDate) metadata.birthDate = info.birthDate
    if (!metadata.gender && info.gender) metadata.gender = info.gender
    if (metadata.age == null && info.age != null) metadata.age = info.age
    if (!metadata.bloodType && info.bloodType) metadata.bloodType = info.bloodType
    if (metadata.height == null && info.height != null) metadata.height = info.height
    if (metadata.weight == null && info.weight != null) metadata.weight = info.weight
    if (metadata.bust == null && info.bust != null) metadata.bust = info.bust
    if (metadata.waist == null && info.waist != null) metadata.waist = info.waist
    if (metadata.hips == null && info.hips != null) metadata.hips = info.hips
    if (!metadata.cup && info.cup) metadata.cup = info.cup
    if (!metadata.description && info.description) metadata.description = info.description

    if (info.relatedSites?.length) {
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
  metadata: Partial<ScrapedCharacterMetadata>,
  results: CharacterScraperTagsResult[],
  strategy: SlotStrategy
): void {
  const sorted = sortByRank(results)

  for (const result of sorted) {
    if (!result.data.length) continue
    metadata.tags = applyStrategy(metadata.tags, result.data, strategy, (t) => t.name)
    if (strategy === 'first' && metadata.tags?.length) break
  }
}

function mergePersons(
  metadata: Partial<ScrapedCharacterMetadata>,
  results: CharacterScraperPersonsResult[],
  options: RelationCollectionMergeOptions
): void {
  const sorted = sortByRank(results)

  for (const result of sorted) {
    if (!result.data.length) continue
    metadata.persons = mergeCharacterPersons(metadata.persons, result.data, options)
    if (options.strategy === 'first' && metadata.persons?.length) break
  }
}

function mergePhotos(
  metadata: Partial<ScrapedCharacterMetadata>,
  results: CharacterScraperPhotosResult[],
  strategy: SlotStrategy
): void {
  const sorted = sortByRank(results)

  for (const result of sorted) {
    if (!result.data.length) continue
    metadata.photos = applyImageStrategy(metadata.photos, result.data, strategy)
    if (strategy === 'first' && metadata.photos?.length) break
  }
}

function finalize(partial: Partial<ScrapedCharacterMetadata>): ScrapedCharacterMetadata | null {
  if (!partial.name) return null

  return {
    identity: partial.identity ?? mergeScrapedIdentities(),
    name: partial.name,
    originalName: partial.originalName,
    birthDate: partial.birthDate,
    gender: partial.gender,
    age: partial.age,
    bloodType: partial.bloodType,
    height: partial.height,
    weight: partial.weight,
    bust: partial.bust,
    waist: partial.waist,
    hips: partial.hips,
    cup: partial.cup,
    description: partial.description ?? '',
    relatedSites: partial.relatedSites ?? [],
    tags: partial.tags,
    persons: partial.persons,
    photos: partial.photos
  }
}

/**
 * Convert merged scraper metadata into a scraper fact bundle.
 */
export function toScrapedCharacterBundle(
  metadata: ScrapedCharacterMetadata
): ScrapedCharacterBundle {
  return {
    identity: metadata.identity,
    core: {
      name: metadata.name,
      originalName: metadata.originalName,
      birthDate: metadata.birthDate,
      gender: metadata.gender,
      age: metadata.age,
      bloodType: metadata.bloodType,
      height: metadata.height,
      weight: metadata.weight,
      bust: metadata.bust,
      waist: metadata.waist,
      hips: metadata.hips,
      cup: metadata.cup,
      description: metadata.description,
      relatedSites: metadata.relatedSites,
      tags: metadata.tags
    },
    relationFacts: metadata.persons?.length
      ? {
          characterPerson: metadata.persons
        }
      : undefined,
    mediaCandidates: metadata.photos?.length
      ? {
          photoUrls: metadata.photos
        }
      : undefined
  }
}
