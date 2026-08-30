/**
 * Shared entry-to-fact mapping.
 *
 * A character, staff member, or producer is the same entity whether it is read
 * from its own endpoint or reached through a visual novel. Each builder
 * returns the facts split by slot, so the satellite providers serve them
 * directly and the game provider folds them into one metadata object plus a
 * role.
 */

import type {
  ScrapedCharacterInfo,
  ScrapedCharacterMetadata,
  ScrapedCompanyInfo,
  ScrapedCompanyMetadata,
  ScrapedEntityIdentity,
  ScrapedPersonInfo,
  ScrapedPersonMetadata,
  ScrapedTag
} from '@kisaki3/extension-sdk'
import type { VndbCharacter, VndbProducer, VndbStaff, VndbTrait } from '../api/types'
import { VNDB_SOURCE_ID } from '../utils/constants'
import { parseVndbBirthday, toPositiveNumber } from './format/dates'
import { mapBloodType, mapCupSize, mapGender, mapProducerType, TAG_NOTES } from './format/enums'
import { resolveEntityDisplayName } from './format/names'
import {
  dedupeExternalIds,
  dedupeExternalSites,
  dedupeImageUrls,
  extractExternalIdsFromExtlinks,
  toExternalSites,
  toOptionalSites,
  vndbSite
} from './format/sites'
import { dedupeTags, isFlagged } from './format/tags'
import { sanitizeVndbText, trimToUndefined } from './format/text'
import type { VndbRequestContext } from './runtime'

/** One entry's facts, grouped the way the scraper slots ask for them. */
export interface VndbSatelliteFacts<TInfo> {
  info: TInfo
  identity: ScrapedEntityIdentity
  tags: ScrapedTag[]
  images: string[]
}

/** Identity of one entry: its own id plus the ids its links reveal. */
export function buildIdentity(
  entryId: string,
  extlinks?: Parameters<typeof extractExternalIdsFromExtlinks>[0]
): ScrapedEntityIdentity {
  return {
    externalIds: dedupeExternalIds([
      { source: VNDB_SOURCE_ID, id: entryId },
      ...extractExternalIdsFromExtlinks(extlinks)
    ])
  }
}

export function buildCharacterFacts(
  character: VndbCharacter,
  traits: ReadonlyMap<string, VndbTrait>,
  ctx: VndbRequestContext
): VndbSatelliteFacts<ScrapedCharacterInfo> {
  const { name, originalName } = resolveEntityDisplayName(
    character.name,
    character.original,
    ctx,
    character.id
  )
  const sites = dedupeExternalSites([vndbSite(character.id)])

  return {
    info: {
      name,
      originalName,
      description: sanitizeVndbText(character.description),
      // `sex` is what the work presents; `gender` is the newer field name.
      gender: mapGender(character.sex ?? character.gender),
      birthDate: parseVndbBirthday(character.birthday),
      bloodType: mapBloodType(character.blood_type),
      cup: mapCupSize(character.cup),
      height: toPositiveNumber(character.height),
      weight: toPositiveNumber(character.weight),
      bust: toPositiveNumber(character.bust),
      waist: toPositiveNumber(character.waist),
      hips: toPositiveNumber(character.hips),
      externalSites: toOptionalSites(sites)
    },
    identity: buildIdentity(character.id),
    tags: buildTraitTags(character, traits),
    images: dedupeImageUrls([character.image])
  }
}

export function buildStaffFacts(
  staffId: string,
  staff: VndbStaff | undefined,
  ctx: VndbRequestContext
): VndbSatelliteFacts<ScrapedPersonInfo> {
  const { name, originalName } = resolveEntityDisplayName(
    staff?.name,
    staff?.original,
    ctx,
    staffId
  )
  const sites = dedupeExternalSites([vndbSite(staffId), ...toExternalSites(staff?.extlinks)])

  return {
    info: {
      name,
      originalName,
      description: sanitizeVndbText(staff?.description),
      gender: mapGender(staff?.gender),
      aliases: buildStaffAliases(staff),
      externalSites: toOptionalSites(sites)
    },
    identity: buildIdentity(staffId, staff?.extlinks),
    tags: [],
    images: []
  }
}

export function buildProducerFacts(
  producerId: string,
  producer: VndbProducer | undefined,
  languageLabels: ReadonlyMap<string, string>,
  ctx: VndbRequestContext
): VndbSatelliteFacts<ScrapedCompanyInfo> {
  const { name, originalName } = resolveEntityDisplayName(
    producer?.name,
    producer?.original,
    ctx,
    producerId
  )
  const sites = dedupeExternalSites([vndbSite(producerId), ...toExternalSites(producer?.extlinks)])

  const tags: ScrapedTag[] = []
  const producerType = mapProducerType(producer?.type)
  if (producerType) {
    tags.push({ name: producerType, note: TAG_NOTES.producerType })
  }
  const language = trimToUndefined(producer?.lang)
  if (language) {
    tags.push({
      name: languageLabels.get(language) ?? language,
      note: TAG_NOTES.primaryLanguage
    })
  }

  return {
    info: {
      name,
      originalName,
      description: sanitizeVndbText(producer?.description),
      externalSites: toOptionalSites(sites)
    },
    identity: buildIdentity(producerId, producer?.extlinks),
    tags: dedupeTags(tags),
    images: []
  }
}

export function toCharacterMetadata(
  facts: VndbSatelliteFacts<ScrapedCharacterInfo>
): ScrapedCharacterMetadata {
  return {
    ...facts.info,
    identity: facts.identity,
    tags: toOptionalArray(facts.tags),
    photos: toOptionalArray(facts.images)
  }
}

export function toPersonMetadata(
  facts: VndbSatelliteFacts<ScrapedPersonInfo>
): ScrapedPersonMetadata {
  return {
    ...facts.info,
    identity: facts.identity,
    tags: toOptionalArray(facts.tags),
    photos: toOptionalArray(facts.images)
  }
}

export function toCompanyMetadata(
  facts: VndbSatelliteFacts<ScrapedCompanyInfo>
): ScrapedCompanyMetadata {
  return {
    ...facts.info,
    identity: facts.identity,
    tags: toOptionalArray(facts.tags),
    logos: toOptionalArray(facts.images)
  }
}

/** Traits are VNDB's character vocabulary; the trait group names the tag. */
function buildTraitTags(
  character: VndbCharacter,
  traits: ReadonlyMap<string, VndbTrait>
): ScrapedTag[] {
  const tags: ScrapedTag[] = []

  for (const relation of character.traits ?? []) {
    const detail = traits.get(relation.id)
    const name = trimToUndefined(detail?.name) ?? relation.id
    const group = trimToUndefined(detail?.group_name)

    tags.push({
      name,
      ...(group ? { note: group } : {}),
      ...(isFlagged(relation.spoiler) ? { isSpoiler: true } : {}),
      ...(isFlagged(relation.sexual ?? detail?.sexual) ? { isNsfw: true } : {})
    })
  }

  return dedupeTags(tags)
}

/** Credited-as names, so a re-scrape can still match an alias-only credit. */
function buildStaffAliases(staff: VndbStaff | undefined): string[] | undefined {
  const aliases: string[] = []

  for (const alias of staff?.aliases ?? []) {
    if (alias?.ismain) {
      continue
    }

    for (const candidate of [alias?.name, alias?.latin]) {
      const value = trimToUndefined(candidate)
      if (value && !aliases.includes(value)) {
        aliases.push(value)
      }
    }
  }

  return aliases.length > 0 ? aliases : undefined
}

function toOptionalArray<T>(values: readonly T[]): T[] | undefined {
  return values.length > 0 ? [...values] : undefined
}
