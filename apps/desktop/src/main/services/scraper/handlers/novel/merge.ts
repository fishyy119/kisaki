import {
  NOVEL_SCRAPER_SLOTS,
  type NovelScraperSlotConfigs,
  type ScraperProfile,
  type SlotStrategy
} from '@shared/db'
import { novelUnitIdentityKey } from '@shared/metadata'
import type {
  ScrapedNovelBundle,
  ScrapedNovelCharacterFact,
  ScrapedNovelCompanyFact,
  ScrapedNovelMetadata,
  ScrapedNovelPersonFact,
  ScrapedEntityIdentity,
  ScrapedRelatedEntryFact
} from '@shared/scraper'
import {
  applyEntityCollectionStrategy,
  applyImageStrategy,
  applyStrategy,
  buildScrapedEntityAliasKeys,
  filterBySlot,
  foldCollectionResults,
  mergeAliases,
  mergeCharacterMetadataFields,
  mergeCompanyMetadataFields,
  mergePersonMetadataFields,
  mergeScrapedIdentities,
  sortByRank,
  type RelationCollectionMergeOptions
} from '../../shared'
import type {
  NovelScraperCharactersResult,
  NovelScraperCompaniesResult,
  NovelScraperImageResult,
  NovelScraperInfoResult,
  NovelScraperPersonsResult,
  NovelScraperRelatedEntriesResult,
  NovelScraperResult,
  NovelScraperTagsResult,
  NovelScraperVolumesResult
} from './types'

/**
 * Merge all provider results into a scraper fact bundle.
 */
export function mergeNovelScraperBundle(
  results: NovelScraperResult[],
  profile: ScraperProfile,
  identities: readonly ScrapedEntityIdentity[] = []
): ScrapedNovelBundle | null {
  const metadata = mergeNovelScraperMetadata(results, profile, identities)
  if (!metadata) return null
  return toScrapedNovelBundle(metadata)
}

function mergeNovelPerson(
  existing: ScrapedNovelPersonFact,
  incoming: ScrapedNovelPersonFact
): ScrapedNovelPersonFact {
  return {
    ...mergePersonMetadataFields(existing, incoming),
    role: existing.role,
    isSpoiler: !!existing.isSpoiler || !!incoming.isSpoiler,
    note: existing.note || incoming.note
  }
}

function mergeNovelCharacter(
  existing: ScrapedNovelCharacterFact,
  incoming: ScrapedNovelCharacterFact,
  options: RelationCollectionMergeOptions
): ScrapedNovelCharacterFact {
  return {
    ...mergeCharacterMetadataFields(existing, incoming, options),
    role: existing.role,
    isSpoiler: !!existing.isSpoiler || !!incoming.isSpoiler,
    note: existing.note || incoming.note
  }
}

function mergeNovelCompany(
  existing: ScrapedNovelCompanyFact,
  incoming: ScrapedNovelCompanyFact
): ScrapedNovelCompanyFact {
  return {
    ...mergeCompanyMetadataFields(existing, incoming),
    role: existing.role,
    isSpoiler: !!existing.isSpoiler || !!incoming.isSpoiler,
    note: existing.note || incoming.note
  }
}

/**
 * Merge all provider results into final ScrapedNovelMetadata.
 * Returns null if no valid name could be determined from any provider.
 */
export function mergeNovelScraperMetadata(
  results: NovelScraperResult[],
  profile: ScraperProfile,
  identities: readonly ScrapedEntityIdentity[] = []
): ScrapedNovelMetadata | null {
  const metadata: Partial<ScrapedNovelMetadata> = {
    identity: mergeScrapedIdentities(...identities)
  }
  const slotConfigs = profile.slotConfigs as NovelScraperSlotConfigs

  for (const slot of NOVEL_SCRAPER_SLOTS) {
    switch (slot) {
      case 'info':
        mergeInfo(metadata, filterBySlot(results, 'info'), slotConfigs.info.strategy)
        break
      case 'tags':
        mergeTags(metadata, filterBySlot(results, 'tags'), slotConfigs.tags.strategy)
        break
      case 'volumes':
        mergeVolumes(metadata, filterBySlot(results, 'volumes'), slotConfigs.volumes.strategy)
        break
      case 'characters':
        mergeCharacters(metadata, filterBySlot(results, 'characters'), {
          strategy: slotConfigs.characters.strategy,
          unmatchedEntityPolicy: slotConfigs.characters.unmatchedEntityPolicy
        })
        break
      case 'persons':
        mergePersons(metadata, filterBySlot(results, 'persons'), {
          strategy: slotConfigs.persons.strategy,
          unmatchedEntityPolicy: slotConfigs.persons.unmatchedEntityPolicy
        })
        break
      case 'companies':
        mergeCompanies(metadata, filterBySlot(results, 'companies'), {
          strategy: slotConfigs.companies.strategy,
          unmatchedEntityPolicy: slotConfigs.companies.unmatchedEntityPolicy
        })
        break
      case 'relatedEntries':
        mergeRelatedEntries(
          metadata,
          filterBySlot(results, 'relatedEntries'),
          slotConfigs.relatedEntries.strategy
        )
        break
      case 'covers':
        mergeImages(metadata, slot, filterByImageSlot(results, slot), slotConfigs.covers.strategy)
        break
      case 'backdrops':
        mergeImages(
          metadata,
          slot,
          filterByImageSlot(results, slot),
          slotConfigs.backdrops.strategy
        )
        break
      case 'logos':
        mergeImages(metadata, slot, filterByImageSlot(results, slot), slotConfigs.logos.strategy)
        break
    }
  }

  return finalize(metadata)
}

/**
 * Merge image results for picker dialogs.
 */
export function mergeNovelScraperImages(
  results: NovelScraperImageResult[],
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

function filterByImageSlot(
  results: NovelScraperResult[],
  slot: 'covers' | 'backdrops' | 'logos'
): NovelScraperImageResult[] {
  return results.filter((result): result is NovelScraperImageResult => result.slot === slot)
}

function mergeInfo(
  metadata: Partial<ScrapedNovelMetadata>,
  results: NovelScraperInfoResult[],
  strategy: SlotStrategy
): void {
  const sorted = sortByRank(results)

  for (const result of sorted) {
    const info = result.data

    if (!metadata.name && info.name) metadata.name = info.name
    if (!metadata.originalName && info.originalName) metadata.originalName = info.originalName
    if (!metadata.releaseDate && info.releaseDate) metadata.releaseDate = info.releaseDate
    if (!metadata.description && info.description) metadata.description = info.description
    if (!metadata.format && info.format) metadata.format = info.format
    if (metadata.totalVolumes == null && info.totalVolumes != null) {
      metadata.totalVolumes = info.totalVolumes
    }

    // Every source's alias is true, so unlike scalars these accumulate.
    if (info.aliases) {
      metadata.aliases = mergeAliases(metadata.aliases, info.aliases)
    }

    // Presence is authority: a provider that reports no sites at all keeps the
    // collection empty instead of leaving it unknown.
    if (info.externalSites) {
      metadata.externalSites = applyStrategy(
        metadata.externalSites,
        info.externalSites,
        strategy,
        (site) => site.url
      )
    }

    if (strategy === 'first') break
  }
}

function mergeTags(
  metadata: Partial<ScrapedNovelMetadata>,
  results: NovelScraperTagsResult[],
  strategy: SlotStrategy
): void {
  metadata.tags = foldCollectionResults(results, strategy, (merged, result) =>
    applyStrategy(merged, result.data, strategy, (tag) => tag.name)
  )
}

function mergeVolumes(
  metadata: Partial<ScrapedNovelMetadata>,
  results: NovelScraperVolumesResult[],
  strategy: SlotStrategy
): void {
  metadata.volumes = foldCollectionResults(results, strategy, (merged, result) =>
    applyStrategy(merged, result.data, strategy, novelUnitIdentityKey)
  )
}

function mergeCharacters(
  metadata: Partial<ScrapedNovelMetadata>,
  results: NovelScraperCharactersResult[],
  options: RelationCollectionMergeOptions
): void {
  metadata.characters = foldCollectionResults(results, options.strategy, (merged, result) =>
    applyEntityCollectionStrategy(
      merged,
      result.data,
      options,
      (character) => buildScrapedEntityAliasKeys(character, { includeCompactFallbackKeys: true }),
      (existing, incoming) => mergeNovelCharacter(existing, incoming, options)
    )
  )
}

function mergePersons(
  metadata: Partial<ScrapedNovelMetadata>,
  results: NovelScraperPersonsResult[],
  options: RelationCollectionMergeOptions
): void {
  metadata.persons = foldCollectionResults(results, options.strategy, (merged, result) =>
    applyEntityCollectionStrategy(
      merged,
      result.data,
      options,
      (person) =>
        buildScrapedEntityAliasKeys(person, {
          includeCompactFallbackKeys: true,
          type: person.role
        }),
      mergeNovelPerson
    )
  )
}

function mergeCompanies(
  metadata: Partial<ScrapedNovelMetadata>,
  results: NovelScraperCompaniesResult[],
  options: RelationCollectionMergeOptions
): void {
  metadata.companies = foldCollectionResults(results, options.strategy, (merged, result) =>
    applyEntityCollectionStrategy(
      merged,
      result.data,
      options,
      (company) =>
        buildScrapedEntityAliasKeys(company, {
          includeCompactFallbackKeys: true,
          type: company.role
        }),
      mergeNovelCompany
    )
  )
}

/** Related entries are keyed by target identity and relation type. */
function relatedEntryKey(fact: ScrapedRelatedEntryFact): string {
  return `${fact.mediaType}#${fact.source}#${fact.externalId}#${fact.type}`
}

function mergeRelatedEntries(
  metadata: Partial<ScrapedNovelMetadata>,
  results: NovelScraperRelatedEntriesResult[],
  strategy: SlotStrategy
): void {
  metadata.relatedEntries = foldCollectionResults(results, strategy, (merged, result) =>
    applyStrategy(merged, result.data, strategy, relatedEntryKey)
  )
}

type ImageSlot = 'covers' | 'backdrops' | 'logos'

function mergeImages(
  metadata: Partial<ScrapedNovelMetadata>,
  slot: ImageSlot,
  results: NovelScraperImageResult[],
  strategy: SlotStrategy
): void {
  metadata[slot] = foldCollectionResults(results, strategy, (merged, result) =>
    applyImageStrategy(merged, result.data, strategy)
  )
}

function finalize(partial: Partial<ScrapedNovelMetadata>): ScrapedNovelMetadata | null {
  if (!partial.name) return null

  return {
    identity: partial.identity ?? mergeScrapedIdentities(),
    name: partial.name,
    originalName: partial.originalName,
    aliases: partial.aliases,
    releaseDate: partial.releaseDate,
    description: partial.description,
    format: partial.format,
    totalVolumes: partial.totalVolumes,
    externalSites: partial.externalSites,
    tags: partial.tags,
    volumes: partial.volumes,
    persons: partial.persons,
    characters: partial.characters,
    companies: partial.companies,
    relatedEntries: partial.relatedEntries,
    covers: partial.covers,
    backdrops: partial.backdrops,
    logos: partial.logos
  }
}

/**
 * Convert merged scraper metadata into a scraper fact bundle.
 */
export function toScrapedNovelBundle(metadata: ScrapedNovelMetadata): ScrapedNovelBundle {
  // Slot presence, not slot content, decides what the bundle claims to know: an
  // empty collection is an authoritative "none", a missing key is "unknown".
  const relationFacts: ScrapedNovelBundle['relationFacts'] = {}
  if (metadata.persons) relationFacts.novelPerson = metadata.persons
  if (metadata.companies) relationFacts.novelCompany = metadata.companies
  if (metadata.characters) relationFacts.novelCharacter = metadata.characters
  if (metadata.relatedEntries) relationFacts.relatedEntries = metadata.relatedEntries

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
        externalSites: character.externalSites,
        identity: character.identity,
        tags: character.tags
      }
    }))
  )
  // Presence survives the flattening: characters that stated no credits leave
  // the channel unanswered, so a scrape never claims authority to clear links
  // another source wrote.
  if (metadata.characters?.some((character) => character.persons !== undefined)) {
    relationFacts.characterPerson = characterPersonFacts ?? []
  }

  const mediaCandidates: ScrapedNovelBundle['mediaCandidates'] = {}
  if (metadata.covers) mediaCandidates.coverUrls = metadata.covers
  if (metadata.backdrops) mediaCandidates.backdropUrls = metadata.backdrops
  if (metadata.logos) mediaCandidates.logoUrls = metadata.logos

  return {
    identity: metadata.identity,
    core: {
      name: metadata.name,
      originalName: metadata.originalName,
      aliases: metadata.aliases,
      releaseDate: metadata.releaseDate,
      description: metadata.description,
      format: metadata.format,
      totalVolumes: metadata.totalVolumes,
      externalSites: metadata.externalSites,
      tags: metadata.tags
    },
    volumes: metadata.volumes,
    relationFacts: Object.keys(relationFacts).length > 0 ? relationFacts : undefined,
    mediaCandidates: Object.keys(mediaCandidates).length > 0 ? mediaCandidates : undefined
  }
}
