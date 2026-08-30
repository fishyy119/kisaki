/**
 * Shared entity-to-fact mapping.
 *
 * A person, character, or company is the same entity whether it is read from
 * its own endpoint or reached through a subject's credits. Each builder
 * returns the facts split by slot, so the standalone providers serve them
 * directly and the subject builders fold them into one metadata object plus a
 * role.
 */

import type {
  ContentLocale,
  ScrapedCharacterInfo,
  ScrapedCharacterMetadata,
  ScrapedCompanyInfo,
  ScrapedCompanyMetadata,
  ScrapedEntityIdentity,
  ScrapedPersonInfo,
  ScrapedPersonMetadata,
  ScrapedTag
} from '@kisaki3/extension-sdk'
import type {
  BangumiCharacterDetail,
  BangumiCharacterType,
  BangumiInfoboxItem,
  BangumiPersonDetail,
  BangumiRelatedCharacter,
  BangumiRelatedPerson
} from '../api/types'
import { BANGUMI_SOURCE_ID } from '../utils/constants'
import { dedupeExternalIds, dedupeTags } from './format/dedupe'
import { toPartialDateFromParts } from './format/dates'
import { extractImageUrls } from './format/images'
import {
  extractAliasesFromInfobox,
  extractExternalIdsFromSites,
  extractExternalSitesFromInfobox
} from './format/infobox'
import { extractCharacterMeasurementsFromInfobox } from './format/measurements'
import { resolveLocalizedEntityName } from './format/names'
import { mapBangumiBloodType, mapBangumiCareersToTags, mapBangumiGender } from './format/roles'
import { normalizeDescription } from './format/text'
import {
  buildBangumiCharacterUrl,
  buildBangumiPersonUrl,
  dedupeExternalSites,
  dedupeUrls
} from './format/urls'

/** One entity's facts, grouped the way the scraper slots ask for them. */
export interface BangumiSatelliteFacts<TInfo> {
  info: TInfo
  identity: ScrapedEntityIdentity
  tags: ScrapedTag[]
  images: string[]
}

/**
 * A person from their own entry, optionally enriched by the compact row a
 * subject's credits embed. The row is the only source when the detail read
 * failed, so a credit still names someone.
 */
export function buildPersonFacts(
  personId: number,
  detail: BangumiPersonDetail | undefined,
  related: BangumiRelatedPerson | undefined,
  locale: ContentLocale | undefined
): BangumiSatelliteFacts<ScrapedPersonInfo> {
  const { name, originalName } = resolveLocalizedEntityName(
    detail?.name || related?.name || String(personId),
    detail?.infobox,
    locale
  )
  const sites = buildPersonSites(personId, detail?.infobox)
  const aliases = extractAliasesFromInfobox(detail?.infobox, [name, originalName])

  return {
    info: {
      name,
      originalName,
      aliases: aliases.length > 0 ? aliases : undefined,
      description: normalizeDescription(detail?.summary),
      gender: mapBangumiGender(detail?.gender),
      birthDate: toPartialDateFromParts(detail?.birth_year, detail?.birth_mon, detail?.birth_day),
      externalSites: sites
    },
    identity: buildIdentity(personId, sites),
    tags: mapBangumiCareersToTags(detail?.career ?? related?.career),
    images: dedupeUrls(extractImageUrls(detail?.images ?? related?.images))
  }
}

/**
 * A company from its own entry. Bangumi files companies as persons, so the
 * shape is the person one minus the personal facts a company cannot have.
 */
export function buildCompanyFacts(
  companyId: number,
  detail: BangumiPersonDetail | undefined,
  related: BangumiRelatedPerson | undefined,
  locale: ContentLocale | undefined
): BangumiSatelliteFacts<ScrapedCompanyInfo> {
  const { name, originalName } = resolveLocalizedEntityName(
    detail?.name || related?.name || String(companyId),
    detail?.infobox,
    locale
  )
  const sites = buildPersonSites(companyId, detail?.infobox)

  return {
    info: {
      name,
      originalName,
      description: normalizeDescription(detail?.summary),
      foundedDate: toPartialDateFromParts(detail?.birth_year, detail?.birth_mon, detail?.birth_day),
      externalSites: sites
    },
    identity: buildIdentity(companyId, sites),
    tags: mapBangumiCareersToTags(detail?.career ?? related?.career),
    images: dedupeUrls(extractImageUrls(detail?.images ?? related?.images))
  }
}

/** A character from their own entry, with the subject credit row as backup. */
export function buildCharacterFacts(
  characterId: number,
  detail: BangumiCharacterDetail | undefined,
  related: BangumiRelatedCharacter | undefined,
  locale: ContentLocale | undefined
): BangumiSatelliteFacts<ScrapedCharacterInfo> {
  const { name, originalName } = resolveLocalizedEntityName(
    detail?.name || related?.name || String(characterId),
    detail?.infobox,
    locale
  )
  const aliases = extractAliasesFromInfobox(detail?.infobox, [name, originalName])
  const measurements = extractCharacterMeasurementsFromInfobox(detail?.infobox)

  const tags: ScrapedTag[] = []
  const typeTag = mapCharacterTypeTag(detail?.type ?? related?.type)
  if (typeTag) {
    tags.push({ name: typeTag, note: CHARACTER_TYPE_NOTE })
  }

  return {
    info: {
      name,
      originalName,
      aliases: aliases.length > 0 ? aliases : undefined,
      description: normalizeDescription(detail?.summary || related?.summary),
      gender: mapBangumiGender(detail?.gender),
      birthDate: toPartialDateFromParts(detail?.birth_year, detail?.birth_mon, detail?.birth_day),
      bloodType: mapBangumiBloodType(detail?.blood_type),
      height: measurements.height,
      weight: measurements.weight,
      bust: measurements.bust,
      waist: measurements.waist,
      hips: measurements.hips,
      externalSites: [{ label: BANGUMI_LABEL, url: buildBangumiCharacterUrl(characterId) }]
    },
    identity: { externalIds: [{ source: BANGUMI_SOURCE_ID, id: String(characterId) }] },
    tags: dedupeTags(tags),
    images: dedupeUrls(extractImageUrls(detail?.images ?? related?.images))
  }
}

export function toPersonMetadata(
  facts: BangumiSatelliteFacts<ScrapedPersonInfo>
): ScrapedPersonMetadata {
  return {
    ...facts.info,
    identity: facts.identity,
    tags: toOptionalArray(facts.tags),
    photos: toOptionalArray(facts.images)
  }
}

export function toCompanyMetadata(
  facts: BangumiSatelliteFacts<ScrapedCompanyInfo>
): ScrapedCompanyMetadata {
  return {
    ...facts.info,
    identity: facts.identity,
    tags: toOptionalArray(facts.tags),
    logos: toOptionalArray(facts.images)
  }
}

export function toCharacterMetadata(
  facts: BangumiSatelliteFacts<ScrapedCharacterInfo>
): ScrapedCharacterMetadata {
  return {
    ...facts.info,
    identity: facts.identity,
    tags: toOptionalArray(facts.tags),
    photos: toOptionalArray(facts.images)
  }
}

/** Site labels are provider names, not translatable copy. */
export const BANGUMI_LABEL = 'Bangumi'
/** Note text is a stable machine-readable qualifier, not translatable copy. */
const CHARACTER_TYPE_NOTE = 'Character Type'

function buildPersonSites(
  personId: number,
  infobox: BangumiInfoboxItem[] | null | undefined
): ReturnType<typeof dedupeExternalSites> {
  return dedupeExternalSites([
    { label: BANGUMI_LABEL, url: buildBangumiPersonUrl(personId) },
    ...extractExternalSitesFromInfobox(infobox)
  ])
}

/** Identity of one entry: its own id plus the ids its infobox links reveal. */
function buildIdentity(
  entityId: number,
  sites: ReturnType<typeof dedupeExternalSites>
): ScrapedEntityIdentity {
  return {
    externalIds: dedupeExternalIds([
      { source: BANGUMI_SOURCE_ID, id: String(entityId) },
      ...extractExternalIdsFromSites(sites)
    ])
  }
}

/**
 * Bangumi files mecha, ships, and organizations under the character entity, so
 * the kind travels as a tag rather than silently reading as a person.
 */
function mapCharacterTypeTag(characterType: BangumiCharacterType | undefined): string | undefined {
  switch (characterType) {
    case 2:
      return 'Mechanic'
    case 3:
      return 'Ship'
    case 4:
      return 'Organization'
    default:
      return undefined
  }
}

/** The collection when the entity has one, or `undefined` when it has none. */
export function toOptionalArray<T>(values: readonly T[]): T[] | undefined {
  return values.length > 0 ? [...values] : undefined
}
