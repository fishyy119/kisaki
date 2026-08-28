/**
 * Fact builders for the satellite entities (staff and characters), shared by
 * the media sessions and the standalone satellite providers so one AniList
 * node always maps to the same fact shape.
 */

import type {
  ContentLocale,
  LibraryBloodType,
  ScrapedCharacterInfo,
  ScrapedCharacterMetadata,
  ScrapedCharacterPersonFact,
  ScrapedIdentityCarrier,
  ScrapedPersonInfo,
  ScrapedPersonMetadata
} from '@kisaki3/extension-sdk'
import type { AnilistCharacterNode, AnilistStaffNode } from '../api/types'
import { omitUndefined } from '../utils/object'
import { parseFuzzyDate } from './format/dates'
import { selectPersonNames } from './format/names'
import { mapGender } from './format/roles'
import { anilistSite, dedupeUrls, toAnilistExternalId } from './format/sites'
import { normalizeDescription, trimToUndefined } from './format/text'

export interface SatelliteContext {
  locale: ContentLocale
}

export function toPersonInfo(
  node: AnilistStaffNode,
  ctx: SatelliteContext
): ScrapedPersonInfo | undefined {
  const names = selectPersonNames(node.name, ctx)
  if (!names) {
    return undefined
  }

  const site = anilistSite(node.siteUrl)

  return omitUndefined({
    name: names.name,
    originalName: names.originalName,
    aliases: names.aliases,
    birthDate: parseFuzzyDate(node.dateOfBirth),
    deathDate: parseFuzzyDate(node.dateOfDeath),
    gender: mapGender(node.gender),
    description: normalizeDescription(node.description),
    externalSites: site ? [site] : undefined
  })
}

export function toPersonMetadata(
  node: AnilistStaffNode,
  ctx: SatelliteContext
): ScrapedPersonMetadata | undefined {
  const info = toPersonInfo(node, ctx)
  if (!info) {
    return undefined
  }

  const photos = dedupeUrls([node.image?.large])

  return omitUndefined({
    ...info,
    identity: { externalIds: [toAnilistExternalId(node.id)] },
    photos: photos.length > 0 ? photos : undefined
  })
}

export function toCharacterInfo(
  node: AnilistCharacterNode,
  ctx: SatelliteContext
): ScrapedCharacterInfo | undefined {
  const names = selectPersonNames(node.name, ctx)
  if (!names) {
    return undefined
  }

  const site = anilistSite(node.siteUrl)

  return omitUndefined({
    name: names.name,
    originalName: names.originalName,
    aliases: names.aliases,
    birthDate: parseFuzzyDate(node.dateOfBirth),
    gender: mapGender(node.gender),
    age: parseAge(node.age),
    bloodType: parseBloodType(node.bloodType),
    description: normalizeDescription(node.description),
    externalSites: site ? [site] : undefined
  })
}

export function toCharacterMetadata(
  node: AnilistCharacterNode,
  ctx: SatelliteContext
): (ScrapedCharacterMetadata & ScrapedIdentityCarrier) | undefined {
  const info = toCharacterInfo(node, ctx)
  if (!info) {
    return undefined
  }

  const photos = dedupeUrls([node.image?.large])

  return omitUndefined({
    ...info,
    identity: { externalIds: [toAnilistExternalId(node.id)] },
    photos: photos.length > 0 ? photos : undefined
  })
}

/** A voice credit stated on a media character edge. */
export function toVoiceActorFact(
  node: AnilistStaffNode,
  ctx: SatelliteContext
): ScrapedCharacterPersonFact | undefined {
  const metadata = toPersonMetadata(node, ctx)
  if (!metadata) {
    return undefined
  }

  return { ...metadata, role: 'actor' }
}

/** Ages arrive as free text such as `"17"`, `"17-18"`, or `"1000+"`. */
function parseAge(value: string | null | undefined): number | undefined {
  const match = /^\s*(\d{1,4})/.exec(value ?? '')
  if (!match) {
    return undefined
  }

  const age = Number(match[1])
  return Number.isInteger(age) && age > 0 ? age : undefined
}

function parseBloodType(value: string | null | undefined): LibraryBloodType | undefined {
  switch (trimToUndefined(value)?.toLowerCase()) {
    case 'a':
      return 'a'
    case 'b':
      return 'b'
    case 'ab':
      return 'ab'
    case 'o':
      return 'o'
    default:
      return undefined
  }
}
