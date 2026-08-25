import {
  COMIC_SCRAPER_SLOTS,
  type ComicScraperSlotConfigs,
  type ScraperProfile,
  type SlotStrategy
} from '@shared/db'
import { comicUnitIdentityKey } from '@shared/metadata'
import type {
  ScrapedComicBundle,
  ScrapedComicCharacterFact,
  ScrapedComicCompanyFact,
  ScrapedComicMetadata,
  ScrapedComicPersonFact,
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
  ComicScraperChaptersResult,
  ComicScraperCharactersResult,
  ComicScraperCompaniesResult,
  ComicScraperImageResult,
  ComicScraperInfoResult,
  ComicScraperPersonsResult,
  ComicScraperRelatedEntriesResult,
  ComicScraperResult,
  ComicScraperTagsResult
} from './types'

/**
 * Merge all provider results into a scraper fact bundle.
 */
export function mergeComicScraperBundle(
  results: ComicScraperResult[],
  profile: ScraperProfile,
  identities: readonly ScrapedEntityIdentity[] = []
): ScrapedComicBundle | null {
  const metadata = mergeComicScraperMetadata(results, profile, identities)
  if (!metadata) return null
  return toScrapedComicBundle(metadata)
}

function mergeComicPerson(
  existing: ScrapedComicPersonFact,
  incoming: ScrapedComicPersonFact
): ScrapedComicPersonFact {
  return {
    ...mergePersonMetadataFields(existing, incoming),
    role: existing.role,
    isSpoiler: !!existing.isSpoiler || !!incoming.isSpoiler,
    note: existing.note || incoming.note
  }
}

function mergeComicCharacter(
  existing: ScrapedComicCharacterFact,
  incoming: ScrapedComicCharacterFact,
  options: RelationCollectionMergeOptions
): ScrapedComicCharacterFact {
  return {
    ...mergeCharacterMetadataFields(existing, incoming, options),
    role: existing.role,
    isSpoiler: !!existing.isSpoiler || !!incoming.isSpoiler,
    note: existing.note || incoming.note
  }
}

function mergeComicCompany(
  existing: ScrapedComicCompanyFact,
  incoming: ScrapedComicCompanyFact
): ScrapedComicCompanyFact {
  return {
    ...mergeCompanyMetadataFields(existing, incoming),
    role: existing.role,
    isSpoiler: !!existing.isSpoiler || !!incoming.isSpoiler,
    note: existing.note || incoming.note
  }
}

/**
 * Merge all provider results into final ScrapedComicMetadata.
 * Returns null if no valid name could be determined from any provider.
 */
export function mergeComicScraperMetadata(
  results: ComicScraperResult[],
  profile: ScraperProfile,
  identities: readonly ScrapedEntityIdentity[] = []
): ScrapedComicMetadata | null {
  const metadata: Partial<ScrapedComicMetadata> = {
    identity: mergeScrapedIdentities(...identities)
  }
  const slotConfigs = profile.slotConfigs as ComicScraperSlotConfigs

  for (const slot of COMIC_SCRAPER_SLOTS) {
    switch (slot) {
      case 'info':
        mergeInfo(metadata, filterBySlot(results, 'info'), slotConfigs.info.strategy)
        break
      case 'tags':
        mergeTags(metadata, filterBySlot(results, 'tags'), slotConfigs.tags.strategy)
        break
      case 'chapters':
        mergeChapters(metadata, filterBySlot(results, 'chapters'), slotConfigs.chapters.strategy)
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
export function mergeComicScraperImages(
  results: ComicScraperImageResult[],
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
  results: ComicScraperResult[],
  slot: 'covers' | 'backdrops' | 'logos'
): ComicScraperImageResult[] {
  return results.filter((result): result is ComicScraperImageResult => result.slot === slot)
}

function mergeInfo(
  metadata: Partial<ScrapedComicMetadata>,
  results: ComicScraperInfoResult[],
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
    if (metadata.totalChapters == null && info.totalChapters != null) {
      metadata.totalChapters = info.totalChapters
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
  metadata: Partial<ScrapedComicMetadata>,
  results: ComicScraperTagsResult[],
  strategy: SlotStrategy
): void {
  metadata.tags = foldCollectionResults(results, strategy, (merged, result) =>
    applyStrategy(merged, result.data, strategy, (tag) => tag.name)
  )
}

function mergeChapters(
  metadata: Partial<ScrapedComicMetadata>,
  results: ComicScraperChaptersResult[],
  strategy: SlotStrategy
): void {
  metadata.chapters = foldCollectionResults(results, strategy, (merged, result) =>
    applyStrategy(merged, result.data, strategy, comicUnitIdentityKey)
  )
}

function mergeCharacters(
  metadata: Partial<ScrapedComicMetadata>,
  results: ComicScraperCharactersResult[],
  options: RelationCollectionMergeOptions
): void {
  metadata.characters = foldCollectionResults(results, options.strategy, (merged, result) =>
    applyEntityCollectionStrategy(
      merged,
      result.data,
      options,
      (character) => buildScrapedEntityAliasKeys(character, { includeCompactFallbackKeys: true }),
      (existing, incoming) => mergeComicCharacter(existing, incoming, options)
    )
  )
}

function mergePersons(
  metadata: Partial<ScrapedComicMetadata>,
  results: ComicScraperPersonsResult[],
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
      mergeComicPerson
    )
  )
}

function mergeCompanies(
  metadata: Partial<ScrapedComicMetadata>,
  results: ComicScraperCompaniesResult[],
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
      mergeComicCompany
    )
  )
}

/** Related entries are keyed by target identity and relation type. */
function relatedEntryKey(fact: ScrapedRelatedEntryFact): string {
  return `${fact.mediaType}#${fact.source}#${fact.externalId}#${fact.type}`
}

function mergeRelatedEntries(
  metadata: Partial<ScrapedComicMetadata>,
  results: ComicScraperRelatedEntriesResult[],
  strategy: SlotStrategy
): void {
  metadata.relatedEntries = foldCollectionResults(results, strategy, (merged, result) =>
    applyStrategy(merged, result.data, strategy, relatedEntryKey)
  )
}

type ImageSlot = 'covers' | 'backdrops' | 'logos'

function mergeImages(
  metadata: Partial<ScrapedComicMetadata>,
  slot: ImageSlot,
  results: ComicScraperImageResult[],
  strategy: SlotStrategy
): void {
  metadata[slot] = foldCollectionResults(results, strategy, (merged, result) =>
    applyImageStrategy(merged, result.data, strategy)
  )
}

function finalize(partial: Partial<ScrapedComicMetadata>): ScrapedComicMetadata | null {
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
    totalChapters: partial.totalChapters,
    externalSites: partial.externalSites,
    tags: partial.tags,
    chapters: partial.chapters,
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
export function toScrapedComicBundle(metadata: ScrapedComicMetadata): ScrapedComicBundle {
  // Slot presence, not slot content, decides what the bundle claims to know: an
  // empty collection is an authoritative "none", a missing key is "unknown".
  const relationFacts: ScrapedComicBundle['relationFacts'] = {}
  if (metadata.persons) relationFacts.comicPerson = metadata.persons
  if (metadata.companies) relationFacts.comicCompany = metadata.companies
  if (metadata.characters) relationFacts.comicCharacter = metadata.characters
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

  const mediaCandidates: ScrapedComicBundle['mediaCandidates'] = {}
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
      totalChapters: metadata.totalChapters,
      externalSites: metadata.externalSites,
      tags: metadata.tags
    },
    chapters: metadata.chapters,
    relationFacts: Object.keys(relationFacts).length > 0 ? relationFacts : undefined,
    mediaCandidates: Object.keys(mediaCandidates).length > 0 ? mediaCandidates : undefined
  }
}
