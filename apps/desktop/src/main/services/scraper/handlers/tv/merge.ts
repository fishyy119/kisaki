import {
  TV_SCRAPER_SLOTS,
  type ScraperProfile,
  type SlotStrategy,
  type TvScraperSlotConfigs
} from '@shared/db'
import type { TvEpisodeInfo, TvSeasonInfo } from '@shared/metadata'
import type {
  ScrapedEntityIdentity,
  ScrapedRelatedEntryFact,
  ScrapedTvBundle,
  ScrapedTvCharacterFact,
  ScrapedTvCompanyFact,
  ScrapedTvMetadata,
  ScrapedTvPersonFact
} from '@shared/scraper'
import {
  applyEntityCollectionStrategy,
  applyImageStrategy,
  applyStrategy,
  buildScrapedEntityAliasKeys,
  filterBySlot,
  foldCollectionResults,
  mergeCharacterMetadataFields,
  mergeCompanyMetadataFields,
  mergePersonMetadataFields,
  mergeScrapedIdentities,
  sortByRank,
  type RelationCollectionMergeOptions
} from '../../shared'
import type {
  TvScraperCharactersResult,
  TvScraperCompaniesResult,
  TvScraperEpisodesResult,
  TvScraperImageResult,
  TvScraperInfoResult,
  TvScraperPersonsResult,
  TvScraperRelatedEntriesResult,
  TvScraperResult,
  TvScraperSeasonsResult,
  TvScraperTagsResult
} from './types'

/**
 * Merge all provider results into a scraper fact bundle.
 */
export function mergeTvScraperBundle(
  results: TvScraperResult[],
  profile: ScraperProfile,
  identities: readonly ScrapedEntityIdentity[] = []
): ScrapedTvBundle | null {
  const metadata = mergeTvScraperMetadata(results, profile, identities)
  if (!metadata) return null
  return toScrapedTvBundle(metadata)
}

function mergeTvPerson(
  existing: ScrapedTvPersonFact,
  incoming: ScrapedTvPersonFact
): ScrapedTvPersonFact {
  return {
    ...mergePersonMetadataFields(existing, incoming),
    role: existing.role,
    isSpoiler: !!existing.isSpoiler || !!incoming.isSpoiler,
    note: existing.note || incoming.note
  }
}

function mergeTvCharacter(
  existing: ScrapedTvCharacterFact,
  incoming: ScrapedTvCharacterFact,
  options: RelationCollectionMergeOptions
): ScrapedTvCharacterFact {
  return {
    ...mergeCharacterMetadataFields(existing, incoming, options),
    role: existing.role,
    isSpoiler: !!existing.isSpoiler || !!incoming.isSpoiler,
    note: existing.note || incoming.note
  }
}

function mergeTvCompany(
  existing: ScrapedTvCompanyFact,
  incoming: ScrapedTvCompanyFact
): ScrapedTvCompanyFact {
  return {
    ...mergeCompanyMetadataFields(existing, incoming),
    role: existing.role,
    isSpoiler: !!existing.isSpoiler || !!incoming.isSpoiler,
    note: existing.note || incoming.note
  }
}

/**
 * Merge all provider results into final ScrapedTvMetadata.
 * Returns null if no valid name could be determined from any provider.
 */
export function mergeTvScraperMetadata(
  results: TvScraperResult[],
  profile: ScraperProfile,
  identities: readonly ScrapedEntityIdentity[] = []
): ScrapedTvMetadata | null {
  const metadata: Partial<ScrapedTvMetadata> = {
    identity: mergeScrapedIdentities(...identities)
  }
  const slotConfigs = profile.slotConfigs as TvScraperSlotConfigs

  for (const slot of TV_SCRAPER_SLOTS) {
    switch (slot) {
      case 'info':
        mergeInfo(metadata, filterBySlot(results, 'info'), slotConfigs.info.strategy)
        break
      case 'tags':
        mergeTags(metadata, filterBySlot(results, 'tags'), slotConfigs.tags.strategy)
        break
      case 'seasons':
        mergeSeasons(metadata, filterBySlot(results, 'seasons'), slotConfigs.seasons.strategy)
        break
      case 'episodes':
        mergeEpisodes(metadata, filterBySlot(results, 'episodes'), slotConfigs.episodes.strategy)
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
export function mergeTvScraperImages(
  results: TvScraperImageResult[],
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
  results: TvScraperResult[],
  slot: 'covers' | 'backdrops' | 'logos'
): TvScraperImageResult[] {
  return results.filter((result): result is TvScraperImageResult => result.slot === slot)
}

function mergeInfo(
  metadata: Partial<ScrapedTvMetadata>,
  results: TvScraperInfoResult[],
  strategy: SlotStrategy
): void {
  const sorted = sortByRank(results)

  for (const result of sorted) {
    const info = result.data

    if (!metadata.name && info.name) metadata.name = info.name
    if (!metadata.originalName && info.originalName) metadata.originalName = info.originalName
    if (!metadata.releaseDate && info.releaseDate) metadata.releaseDate = info.releaseDate
    if (!metadata.endDate && info.endDate) metadata.endDate = info.endDate
    if (!metadata.description && info.description) metadata.description = info.description
    if (!metadata.format && info.format) metadata.format = info.format
    if (metadata.totalSeasons == null && info.totalSeasons != null) {
      metadata.totalSeasons = info.totalSeasons
    }
    if (metadata.totalEpisodes == null && info.totalEpisodes != null) {
      metadata.totalEpisodes = info.totalEpisodes
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
  metadata: Partial<ScrapedTvMetadata>,
  results: TvScraperTagsResult[],
  strategy: SlotStrategy
): void {
  metadata.tags = foldCollectionResults(results, strategy, (merged, result) =>
    applyStrategy(merged, result.data, strategy, (tag) => tag.name)
  )
}

/** Seasons are keyed by number, the one key every source agrees on. */
function seasonKey(season: TvSeasonInfo): string {
  return `${season.number}`
}

function mergeSeasons(
  metadata: Partial<ScrapedTvMetadata>,
  results: TvScraperSeasonsResult[],
  strategy: SlotStrategy
): void {
  metadata.seasons = foldCollectionResults(results, strategy, (merged, result) =>
    applyStrategy(merged, result.data, strategy, seasonKey)
  )
}

/** Episodes are keyed by season and number, the stable cross-source pair. */
function episodeKey(episode: TvEpisodeInfo): string {
  return `${episode.seasonNumber}#${episode.number}`
}

function mergeEpisodes(
  metadata: Partial<ScrapedTvMetadata>,
  results: TvScraperEpisodesResult[],
  strategy: SlotStrategy
): void {
  metadata.episodes = foldCollectionResults(results, strategy, (merged, result) =>
    applyStrategy(merged, result.data, strategy, episodeKey)
  )
}

function mergeCharacters(
  metadata: Partial<ScrapedTvMetadata>,
  results: TvScraperCharactersResult[],
  options: RelationCollectionMergeOptions
): void {
  metadata.characters = foldCollectionResults(results, options.strategy, (merged, result) =>
    applyEntityCollectionStrategy(
      merged,
      result.data,
      options,
      (character) => buildScrapedEntityAliasKeys(character, { includeCompactFallbackKeys: true }),
      (existing, incoming) => mergeTvCharacter(existing, incoming, options)
    )
  )
}

function mergePersons(
  metadata: Partial<ScrapedTvMetadata>,
  results: TvScraperPersonsResult[],
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
      mergeTvPerson
    )
  )
}

function mergeCompanies(
  metadata: Partial<ScrapedTvMetadata>,
  results: TvScraperCompaniesResult[],
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
      mergeTvCompany
    )
  )
}

/** Related entries are keyed by target identity and relation type. */
function relatedEntryKey(fact: ScrapedRelatedEntryFact): string {
  return `${fact.mediaType}#${fact.source}#${fact.externalId}#${fact.type}`
}

function mergeRelatedEntries(
  metadata: Partial<ScrapedTvMetadata>,
  results: TvScraperRelatedEntriesResult[],
  strategy: SlotStrategy
): void {
  metadata.relatedEntries = foldCollectionResults(results, strategy, (merged, result) =>
    applyStrategy(merged, result.data, strategy, relatedEntryKey)
  )
}

type ImageSlot = 'covers' | 'backdrops' | 'logos'

function mergeImages(
  metadata: Partial<ScrapedTvMetadata>,
  slot: ImageSlot,
  results: TvScraperImageResult[],
  strategy: SlotStrategy
): void {
  metadata[slot] = foldCollectionResults(results, strategy, (merged, result) =>
    applyImageStrategy(merged, result.data, strategy)
  )
}

function finalize(partial: Partial<ScrapedTvMetadata>): ScrapedTvMetadata | null {
  if (!partial.name) return null

  return {
    identity: partial.identity ?? mergeScrapedIdentities(),
    name: partial.name,
    originalName: partial.originalName,
    releaseDate: partial.releaseDate,
    endDate: partial.endDate,
    description: partial.description,
    format: partial.format,
    totalSeasons: partial.totalSeasons,
    totalEpisodes: partial.totalEpisodes,
    externalSites: partial.externalSites,
    tags: partial.tags,
    seasons: partial.seasons,
    episodes: partial.episodes,
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
export function toScrapedTvBundle(metadata: ScrapedTvMetadata): ScrapedTvBundle {
  // Slot presence, not slot content, decides what the bundle claims to know: an
  // empty collection is an authoritative "none", a missing key is "unknown".
  const relationFacts: ScrapedTvBundle['relationFacts'] = {}
  if (metadata.persons) relationFacts.tvPerson = metadata.persons
  if (metadata.companies) relationFacts.tvCompany = metadata.companies
  if (metadata.characters) relationFacts.tvCharacter = metadata.characters
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
  if (characterPersonFacts) {
    relationFacts.characterPerson = characterPersonFacts
  }

  const mediaCandidates: ScrapedTvBundle['mediaCandidates'] = {}
  if (metadata.covers) mediaCandidates.coverUrls = metadata.covers
  if (metadata.backdrops) mediaCandidates.backdropUrls = metadata.backdrops
  if (metadata.logos) mediaCandidates.logoUrls = metadata.logos

  return {
    identity: metadata.identity,
    core: {
      name: metadata.name,
      originalName: metadata.originalName,
      releaseDate: metadata.releaseDate,
      endDate: metadata.endDate,
      description: metadata.description,
      format: metadata.format,
      totalSeasons: metadata.totalSeasons,
      totalEpisodes: metadata.totalEpisodes,
      externalSites: metadata.externalSites,
      tags: metadata.tags
    },
    seasons: metadata.seasons,
    episodes: metadata.episodes,
    relationFacts: Object.keys(relationFacts).length > 0 ? relationFacts : undefined,
    mediaCandidates: Object.keys(mediaCandidates).length > 0 ? mediaCandidates : undefined
  }
}
