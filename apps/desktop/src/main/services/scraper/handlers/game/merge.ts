import { GAME_SCRAPER_SLOTS, type ScraperProfile, type ScraperSlotResultStrategy } from '@shared/db'
import { buildEntityAliasKeys, normalizeExternalIds, toExternalIdKey } from '@shared/identity'
import type {
  ScrapedGameCharacterFact,
  ScrapedGameCompanyFact,
  ScrapedGameMetadata,
  ScrapedGamePersonFact,
  ScrapedGameBundle
} from '@shared/scraper'
import {
  applyEntityCollectionStrategy,
  applyImageStrategy,
  applyStrategy,
  filterBySlot,
  mergeCharacterMetadataFields,
  mergeCompanyMetadataFields,
  mergePersonMetadataFields,
  sortByPriority
} from '../../utils'
import type {
  GameScraperCharactersResult,
  GameScraperCompaniesResult,
  GameScraperImageResult,
  GameScraperInfoResult,
  GameScraperPersonsResult,
  GameScraperResult,
  GameScraperTagsResult
} from './types'

/**
 * Merge all provider results into a scraper fact bundle.
 */
export function mergeGameScraperBundle(
  results: GameScraperResult[],
  profile: ScraperProfile
): ScrapedGameBundle | null {
  const metadata = mergeGameScraperMetadata(results, profile)
  if (!metadata) return null
  return toScrapedGameBundle(metadata)
}

function mergeGamePerson(
  existing: ScrapedGamePersonFact,
  incoming: ScrapedGamePersonFact
): ScrapedGamePersonFact {
  return {
    ...mergePersonMetadataFields(existing, incoming),
    type: existing.type,
    isSpoiler: !!existing.isSpoiler || !!incoming.isSpoiler,
    note: existing.note || incoming.note
  }
}

function mergeGameCharacter(
  existing: ScrapedGameCharacterFact,
  incoming: ScrapedGameCharacterFact,
  personStrategy: ScraperSlotResultStrategy
): ScrapedGameCharacterFact {
  return {
    ...mergeCharacterMetadataFields(existing, incoming, personStrategy),
    type: existing.type,
    isSpoiler: !!existing.isSpoiler || !!incoming.isSpoiler,
    note: existing.note || incoming.note
  }
}

function mergeGameCompany(
  existing: ScrapedGameCompanyFact,
  incoming: ScrapedGameCompanyFact
): ScrapedGameCompanyFact {
  return {
    ...mergeCompanyMetadataFields(existing, incoming),
    type: existing.type,
    isSpoiler: !!existing.isSpoiler || !!incoming.isSpoiler,
    note: existing.note || incoming.note
  }
}

/**
 * Merge all provider results into final ScrapedGameMetadata.
 * Returns null if no valid name could be determined from any provider.
 */
export function mergeGameScraperMetadata(
  results: GameScraperResult[],
  profile: ScraperProfile
): ScrapedGameMetadata | null {
  const metadata: Partial<ScrapedGameMetadata> = {}

  for (const slot of GAME_SCRAPER_SLOTS) {
    const config = profile.slotConfigs[slot]
    const strategy = config.resultStrategy

    switch (slot) {
      case 'info':
        mergeInfo(metadata, filterBySlot(results, 'info'), strategy)
        break
      case 'tags':
        mergeTags(metadata, filterBySlot(results, 'tags'), strategy)
        break
      case 'characters': {
        const personStrategy = profile.slotConfigs['persons'].resultStrategy
        mergeCharacters(metadata, filterBySlot(results, 'characters'), strategy, personStrategy)
        break
      }
      case 'persons':
        mergePersons(metadata, filterBySlot(results, 'persons'), strategy)
        break
      case 'companies':
        mergeCompanies(metadata, filterBySlot(results, 'companies'), strategy)
        break
      case 'covers':
      case 'backdrops':
      case 'logos':
      case 'icons':
        mergeImages(metadata, slot, filterByImageSlot(results, slot), strategy)
        break
    }
  }

  return finalize(metadata)
}

/**
 * Merge image results for picker dialogs.
 */
export function mergeGameScraperImages(
  results: GameScraperImageResult[],
  strategy: ScraperSlotResultStrategy
): string[] {
  const sorted = sortByPriority(results)
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

function filterByImageSlot(
  results: GameScraperResult[],
  slot: 'covers' | 'backdrops' | 'logos' | 'icons'
): GameScraperImageResult[] {
  return results.filter((result): result is GameScraperImageResult => result.slot === slot)
}

function mergeInfo(
  metadata: Partial<ScrapedGameMetadata>,
  results: GameScraperInfoResult[],
  strategy: ScraperSlotResultStrategy
): void {
  const sorted = sortByPriority(results)

  for (const result of sorted) {
    const info = result.data

    if (!metadata.name && info.name) metadata.name = info.name
    if (!metadata.originalName && info.originalName) metadata.originalName = info.originalName
    if (!metadata.releaseDate && info.releaseDate) {
      metadata.releaseDate = info.releaseDate
    }
    if (!metadata.description && info.description) metadata.description = info.description

    if (info.relatedSites?.length) {
      metadata.relatedSites = applyStrategy(
        metadata.relatedSites,
        info.relatedSites,
        strategy,
        (site) => site.url
      )
    }

    if (info.externalIds?.length) {
      metadata.externalIds = normalizeExternalIds(
        applyStrategy(metadata.externalIds, info.externalIds, strategy, toExternalIdKey)
      )
    }

    if (strategy === 'first' && isInfoComplete(metadata)) break
  }
}

function isInfoComplete(metadata: Partial<ScrapedGameMetadata>): boolean {
  return !!(metadata.name && metadata.releaseDate && metadata.description)
}

function mergeTags(
  metadata: Partial<ScrapedGameMetadata>,
  results: GameScraperTagsResult[],
  strategy: ScraperSlotResultStrategy
): void {
  const sorted = sortByPriority(results)

  for (const result of sorted) {
    if (!result.data.length) continue

    metadata.tags = applyStrategy(metadata.tags, result.data, strategy, (tag) => tag.name)

    if (strategy === 'first' && metadata.tags?.length) break
  }
}

function mergeCharacters(
  metadata: Partial<ScrapedGameMetadata>,
  results: GameScraperCharactersResult[],
  strategy: ScraperSlotResultStrategy,
  personStrategy: ScraperSlotResultStrategy
): void {
  const sorted = sortByPriority(results)

  for (const result of sorted) {
    if (!result.data.length) continue

    metadata.characters = applyEntityCollectionStrategy(
      metadata.characters,
      result.data,
      strategy,
      (character) => buildEntityAliasKeys(character, { includeCompactFallbackKeys: true }),
      (existing, incoming) => mergeGameCharacter(existing, incoming, personStrategy)
    )

    if (strategy === 'first' && metadata.characters?.length) break
  }
}

function mergePersons(
  metadata: Partial<ScrapedGameMetadata>,
  results: GameScraperPersonsResult[],
  strategy: ScraperSlotResultStrategy
): void {
  const sorted = sortByPriority(results)

  for (const result of sorted) {
    if (!result.data.length) continue

    metadata.persons = applyEntityCollectionStrategy(
      metadata.persons,
      result.data,
      strategy,
      (person) =>
        buildEntityAliasKeys(person, {
          includeCompactFallbackKeys: true,
          type: person.type
        }),
      mergeGamePerson
    )

    if (strategy === 'first' && metadata.persons?.length) break
  }
}

function mergeCompanies(
  metadata: Partial<ScrapedGameMetadata>,
  results: GameScraperCompaniesResult[],
  strategy: ScraperSlotResultStrategy
): void {
  const sorted = sortByPriority(results)

  for (const result of sorted) {
    if (!result.data.length) continue

    metadata.companies = applyEntityCollectionStrategy(
      metadata.companies,
      result.data,
      strategy,
      (company) =>
        buildEntityAliasKeys(company, {
          includeCompactFallbackKeys: true,
          type: company.type
        }),
      mergeGameCompany
    )

    if (strategy === 'first' && metadata.companies?.length) break
  }
}

type ImageSlot = 'covers' | 'backdrops' | 'logos' | 'icons'

function mergeImages(
  metadata: Partial<ScrapedGameMetadata>,
  slot: ImageSlot,
  results: GameScraperImageResult[],
  strategy: ScraperSlotResultStrategy
): void {
  const sorted = sortByPriority(results)

  for (const result of sorted) {
    if (!result.data.length) continue

    metadata[slot] = applyImageStrategy(metadata[slot], result.data, strategy)

    if (strategy === 'first' && metadata[slot]?.length) break
  }
}

function finalize(partial: Partial<ScrapedGameMetadata>): ScrapedGameMetadata | null {
  if (!partial.name) return null

  return {
    name: partial.name,
    originalName: partial.originalName,
    releaseDate: partial.releaseDate,
    description: partial.description ?? '',
    relatedSites: partial.relatedSites ?? [],
    externalIds: partial.externalIds ?? [],
    tags: partial.tags,
    persons: partial.persons,
    characters: partial.characters,
    companies: partial.companies,
    covers: partial.covers,
    backdrops: partial.backdrops,
    logos: partial.logos,
    icons: partial.icons
  }
}

/**
 * Convert merged scraper metadata into a scraper fact bundle.
 */
export function toScrapedGameBundle(metadata: ScrapedGameMetadata): ScrapedGameBundle {
  const relationFacts: ScrapedGameBundle['relationFacts'] = {}
  if (metadata.persons?.length) relationFacts.gamePerson = metadata.persons
  if (metadata.companies?.length) relationFacts.gameCompany = metadata.companies
  if (metadata.characters?.length) relationFacts.gameCharacter = metadata.characters

  const characterPersonFacts = metadata.characters?.flatMap((character) =>
    (character.persons ?? []).map((personFact) => ({
      ...personFact,
      character: {
        name: character.name,
        originalName: character.originalName,
        birthDate: character.birthDate,
        gender: character.gender,
        age: character.age,
        bloodType: character.bloodType,
        height: character.height,
        weight: character.weight,
        bust: character.bust,
        waist: character.waist,
        hips: character.hips,
        cup: character.cup,
        description: character.description,
        relatedSites: character.relatedSites,
        externalIds: character.externalIds,
        tags: character.tags
      }
    }))
  )
  if (characterPersonFacts?.length) {
    relationFacts.characterPerson = characterPersonFacts
  }

  const mediaCandidates: ScrapedGameBundle['mediaCandidates'] = {}
  if (metadata.covers?.length) mediaCandidates.coverUrls = metadata.covers
  if (metadata.backdrops?.length) mediaCandidates.backdropUrls = metadata.backdrops
  if (metadata.logos?.length) mediaCandidates.logoUrls = metadata.logos
  if (metadata.icons?.length) mediaCandidates.iconUrls = metadata.icons

  return {
    core: {
      name: metadata.name,
      originalName: metadata.originalName,
      releaseDate: metadata.releaseDate,
      description: metadata.description,
      relatedSites: metadata.relatedSites,
      externalIds: metadata.externalIds,
      tags: metadata.tags
    },
    relationFacts: Object.keys(relationFacts).length > 0 ? relationFacts : undefined,
    mediaCandidates: Object.keys(mediaCandidates).length > 0 ? mediaCandidates : undefined
  }
}
