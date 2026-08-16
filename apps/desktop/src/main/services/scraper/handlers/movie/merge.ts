import {
  MOVIE_SCRAPER_SLOTS,
  type MovieScraperSlotConfigs,
  type ScraperProfile,
  type SlotStrategy
} from '@shared/db'
import type {
  ScrapedEntityIdentity,
  ScrapedMovieBundle,
  ScrapedMovieCharacterFact,
  ScrapedMovieCompanyFact,
  ScrapedMovieMetadata,
  ScrapedMoviePersonFact,
  ScrapedRelatedEntryFact
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
  MovieScraperCharactersResult,
  MovieScraperCompaniesResult,
  MovieScraperImageResult,
  MovieScraperInfoResult,
  MovieScraperPersonsResult,
  MovieScraperRelatedEntriesResult,
  MovieScraperResult,
  MovieScraperTagsResult
} from './types'

/**
 * Merge all provider results into a scraper fact bundle.
 */
export function mergeMovieScraperBundle(
  results: MovieScraperResult[],
  profile: ScraperProfile,
  identities: readonly ScrapedEntityIdentity[] = []
): ScrapedMovieBundle | null {
  const metadata = mergeMovieScraperMetadata(results, profile, identities)
  if (!metadata) return null
  return toScrapedMovieBundle(metadata)
}

function mergeMoviePerson(
  existing: ScrapedMoviePersonFact,
  incoming: ScrapedMoviePersonFact
): ScrapedMoviePersonFact {
  return {
    ...mergePersonMetadataFields(existing, incoming),
    role: existing.role,
    isSpoiler: !!existing.isSpoiler || !!incoming.isSpoiler,
    note: existing.note || incoming.note
  }
}

function mergeMovieCharacter(
  existing: ScrapedMovieCharacterFact,
  incoming: ScrapedMovieCharacterFact,
  options: RelationCollectionMergeOptions
): ScrapedMovieCharacterFact {
  return {
    ...mergeCharacterMetadataFields(existing, incoming, options),
    role: existing.role,
    isSpoiler: !!existing.isSpoiler || !!incoming.isSpoiler,
    note: existing.note || incoming.note
  }
}

function mergeMovieCompany(
  existing: ScrapedMovieCompanyFact,
  incoming: ScrapedMovieCompanyFact
): ScrapedMovieCompanyFact {
  return {
    ...mergeCompanyMetadataFields(existing, incoming),
    role: existing.role,
    isSpoiler: !!existing.isSpoiler || !!incoming.isSpoiler,
    note: existing.note || incoming.note
  }
}

/**
 * Merge all provider results into final ScrapedMovieMetadata.
 * Returns null if no valid name could be determined from any provider.
 */
export function mergeMovieScraperMetadata(
  results: MovieScraperResult[],
  profile: ScraperProfile,
  identities: readonly ScrapedEntityIdentity[] = []
): ScrapedMovieMetadata | null {
  const metadata: Partial<ScrapedMovieMetadata> = {
    identity: mergeScrapedIdentities(...identities)
  }
  const slotConfigs = profile.slotConfigs as MovieScraperSlotConfigs

  for (const slot of MOVIE_SCRAPER_SLOTS) {
    switch (slot) {
      case 'info':
        mergeInfo(metadata, filterBySlot(results, 'info'), slotConfigs.info.strategy)
        break
      case 'tags':
        mergeTags(metadata, filterBySlot(results, 'tags'), slotConfigs.tags.strategy)
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
export function mergeMovieScraperImages(
  results: MovieScraperImageResult[],
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
  results: MovieScraperResult[],
  slot: 'covers' | 'backdrops' | 'logos'
): MovieScraperImageResult[] {
  return results.filter((result): result is MovieScraperImageResult => result.slot === slot)
}

function mergeInfo(
  metadata: Partial<ScrapedMovieMetadata>,
  results: MovieScraperInfoResult[],
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
    if (metadata.runtimeMs == null && info.runtimeMs != null) {
      metadata.runtimeMs = info.runtimeMs
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
  metadata: Partial<ScrapedMovieMetadata>,
  results: MovieScraperTagsResult[],
  strategy: SlotStrategy
): void {
  metadata.tags = foldCollectionResults(results, strategy, (merged, result) =>
    applyStrategy(merged, result.data, strategy, (tag) => tag.name)
  )
}

function mergeCharacters(
  metadata: Partial<ScrapedMovieMetadata>,
  results: MovieScraperCharactersResult[],
  options: RelationCollectionMergeOptions
): void {
  metadata.characters = foldCollectionResults(results, options.strategy, (merged, result) =>
    applyEntityCollectionStrategy(
      merged,
      result.data,
      options,
      (character) => buildScrapedEntityAliasKeys(character, { includeCompactFallbackKeys: true }),
      (existing, incoming) => mergeMovieCharacter(existing, incoming, options)
    )
  )
}

function mergePersons(
  metadata: Partial<ScrapedMovieMetadata>,
  results: MovieScraperPersonsResult[],
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
      mergeMoviePerson
    )
  )
}

function mergeCompanies(
  metadata: Partial<ScrapedMovieMetadata>,
  results: MovieScraperCompaniesResult[],
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
      mergeMovieCompany
    )
  )
}

/** Related entries are keyed by target identity and relation type. */
function relatedEntryKey(fact: ScrapedRelatedEntryFact): string {
  return `${fact.mediaType}#${fact.source}#${fact.externalId}#${fact.type}`
}

function mergeRelatedEntries(
  metadata: Partial<ScrapedMovieMetadata>,
  results: MovieScraperRelatedEntriesResult[],
  strategy: SlotStrategy
): void {
  metadata.relatedEntries = foldCollectionResults(results, strategy, (merged, result) =>
    applyStrategy(merged, result.data, strategy, relatedEntryKey)
  )
}

type ImageSlot = 'covers' | 'backdrops' | 'logos'

function mergeImages(
  metadata: Partial<ScrapedMovieMetadata>,
  slot: ImageSlot,
  results: MovieScraperImageResult[],
  strategy: SlotStrategy
): void {
  metadata[slot] = foldCollectionResults(results, strategy, (merged, result) =>
    applyImageStrategy(merged, result.data, strategy)
  )
}

function finalize(partial: Partial<ScrapedMovieMetadata>): ScrapedMovieMetadata | null {
  if (!partial.name) return null

  return {
    identity: partial.identity ?? mergeScrapedIdentities(),
    name: partial.name,
    originalName: partial.originalName,
    releaseDate: partial.releaseDate,
    description: partial.description,
    format: partial.format,
    runtimeMs: partial.runtimeMs,
    externalSites: partial.externalSites,
    tags: partial.tags,
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
export function toScrapedMovieBundle(metadata: ScrapedMovieMetadata): ScrapedMovieBundle {
  // Slot presence, not slot content, decides what the bundle claims to know: an
  // empty collection is an authoritative "none", a missing key is "unknown".
  const relationFacts: ScrapedMovieBundle['relationFacts'] = {}
  if (metadata.persons) relationFacts.moviePerson = metadata.persons
  if (metadata.companies) relationFacts.movieCompany = metadata.companies
  if (metadata.characters) relationFacts.movieCharacter = metadata.characters
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

  const mediaCandidates: ScrapedMovieBundle['mediaCandidates'] = {}
  if (metadata.covers) mediaCandidates.coverUrls = metadata.covers
  if (metadata.backdrops) mediaCandidates.backdropUrls = metadata.backdrops
  if (metadata.logos) mediaCandidates.logoUrls = metadata.logos

  return {
    identity: metadata.identity,
    core: {
      name: metadata.name,
      originalName: metadata.originalName,
      releaseDate: metadata.releaseDate,
      description: metadata.description,
      format: metadata.format,
      runtimeMs: metadata.runtimeMs,
      externalSites: metadata.externalSites,
      tags: metadata.tags
    },
    relationFacts: Object.keys(relationFacts).length > 0 ? relationFacts : undefined,
    mediaCandidates: Object.keys(mediaCandidates).length > 0 ? mediaCandidates : undefined
  }
}
