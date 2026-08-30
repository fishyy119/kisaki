/**
 * Shared archive-to-fact mapping.
 *
 * A person, character, or organization is the same entity whether it is read
 * from its own archive or nested inside a game archive. Each builder returns
 * the facts split by slot, so the satellite providers serve them directly and
 * the game provider folds them into one metadata object plus a role.
 */

import type {
  ExternalSite,
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
  YmgalCharacter,
  YmgalCharacterMapping,
  YmgalOrganization,
  YmgalPerson,
  YmgalPersonMapping
} from '../api/types'
import { YMGAL_SOURCE_ID } from '../utils/constants'
import { parseYmgalDate } from './format/dates'
import { dedupeImageUrls } from './format/images'
import { resolveDisplayName } from './format/names'
import { mapGender } from './format/roles'
import {
  dedupeExternalIds,
  dedupeExternalSites,
  extractExternalIdsFromSites,
  toExternalSites,
  toOptionalSites,
  ymgalCharacterUrl,
  ymgalOrganizationUrl,
  ymgalPersonUrl,
  ymgalSite
} from './format/sites'
import { buildCountryTags } from './format/tags'
import { normalizeDescription } from './format/text'
import type { YmgalRequestContext } from './runtime'

/** One archive's facts, grouped the way the scraper slots ask for them. */
export interface YmgalSatelliteFacts<TInfo> {
  info: TInfo
  identity: ScrapedEntityIdentity
  tags: ScrapedTag[]
  images: string[]
}

/** Identity of one archive: its own id plus the ids its links reveal. */
export function buildIdentity(
  archiveId: string,
  sites: readonly ExternalSite[]
): ScrapedEntityIdentity {
  return {
    externalIds: dedupeExternalIds([
      { source: YMGAL_SOURCE_ID, id: archiveId },
      ...extractExternalIdsFromSites(sites)
    ])
  }
}

/**
 * A person from their archive, optionally enriched by the compact snapshot a
 * game archive embeds. The snapshot is the only source when the archive read
 * failed, so a credit still names someone.
 */
export function buildPersonFacts(
  personId: string,
  detail: YmgalPerson | undefined,
  snapshot: YmgalPersonMapping | undefined,
  ctx: YmgalRequestContext
): YmgalSatelliteFacts<ScrapedPersonInfo> {
  const { name, originalName } = resolveDisplayName(
    detail?.name ?? snapshot?.name,
    detail?.chineseName ?? snapshot?.chineseName,
    ctx,
    personId
  )
  const sites = dedupeExternalSites([
    ymgalSite(ymgalPersonUrl(personId)),
    ...toExternalSites(detail?.website)
  ])

  return {
    info: {
      name,
      originalName,
      description: normalizeDescription(detail?.introduction),
      birthDate: parseYmgalDate(detail?.birthday),
      gender: mapGender(detail?.gender),
      externalSites: toOptionalSites(sites)
    },
    identity: buildIdentity(personId, sites),
    tags: buildCountryTags(detail?.country),
    images: dedupeImageUrls([detail?.mainImg, snapshot?.mainImg])
  }
}

/** A character from their archive, with the game archive snapshot as backup. */
export function buildCharacterFacts(
  characterId: string,
  detail: YmgalCharacter | undefined,
  snapshot: YmgalCharacterMapping | undefined,
  ctx: YmgalRequestContext
): YmgalSatelliteFacts<ScrapedCharacterInfo> {
  const { name, originalName } = resolveDisplayName(
    detail?.name ?? snapshot?.name,
    detail?.chineseName ?? snapshot?.chineseName,
    ctx,
    characterId
  )
  const sites = dedupeExternalSites([ymgalSite(ymgalCharacterUrl(characterId))])

  return {
    info: {
      name,
      originalName,
      description: normalizeDescription(detail?.introduction),
      birthDate: parseYmgalDate(detail?.birthday),
      gender: mapGender(detail?.gender),
      externalSites: toOptionalSites(sites)
    },
    identity: buildIdentity(characterId, sites),
    tags: [],
    images: dedupeImageUrls([detail?.mainImg, snapshot?.mainImg])
  }
}

/** An organization from its archive. */
export function buildCompanyFacts(
  organizationId: string,
  detail: YmgalOrganization | undefined,
  ctx: YmgalRequestContext
): YmgalSatelliteFacts<ScrapedCompanyInfo> {
  const { name, originalName } = resolveDisplayName(
    detail?.name,
    detail?.chineseName,
    ctx,
    organizationId
  )
  const sites = dedupeExternalSites([
    ymgalSite(ymgalOrganizationUrl(organizationId)),
    ...toExternalSites(detail?.website)
  ])

  return {
    info: {
      name,
      originalName,
      description: normalizeDescription(detail?.introduction),
      foundedDate: parseYmgalDate(detail?.birthday),
      externalSites: toOptionalSites(sites)
    },
    identity: buildIdentity(organizationId, sites),
    tags: buildCountryTags(detail?.country),
    images: dedupeImageUrls([detail?.mainImg])
  }
}

export function toPersonMetadata(
  facts: YmgalSatelliteFacts<ScrapedPersonInfo>
): ScrapedPersonMetadata {
  return {
    ...facts.info,
    identity: facts.identity,
    tags: toOptionalArray(facts.tags),
    photos: toOptionalArray(facts.images)
  }
}

export function toCharacterMetadata(
  facts: YmgalSatelliteFacts<ScrapedCharacterInfo>
): ScrapedCharacterMetadata {
  return {
    ...facts.info,
    identity: facts.identity,
    tags: toOptionalArray(facts.tags),
    photos: toOptionalArray(facts.images)
  }
}

export function toCompanyMetadata(
  facts: YmgalSatelliteFacts<ScrapedCompanyInfo>
): ScrapedCompanyMetadata {
  return {
    ...facts.info,
    identity: facts.identity,
    tags: toOptionalArray(facts.tags),
    logos: toOptionalArray(facts.images)
  }
}

function toOptionalArray<T>(values: readonly T[]): T[] | undefined {
  return values.length > 0 ? [...values] : undefined
}
