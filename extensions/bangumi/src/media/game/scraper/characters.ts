import type {
  Locale,
  ScrapedCharacterPersonFact,
  ScrapedGameCharacterFact,
  ScrapedTag
} from '@kisaki3/extension-sdk'
import type { BangumiClient } from '../../../api/client'
import type {
  BangumiCharacterDetail,
  BangumiCharacterPerson,
  BangumiRelatedCharacter
} from '../../../api/types'
import { BANGUMI_SOURCE_ID, BANGUMI_SUBJECT_TYPE_GAME } from '../../../shared/constants'
import { omitUndefined } from '../../../shared/object'
import { dedupeTags } from './format/dedupe'
import { toPartialDateFromParts } from './format/dates'
import { extractImageUrls } from './format/images'
import { extractCharacterMeasurementsFromInfobox } from './format/measurements'
import { resolveLocalizedEntityName } from './format/names'
import {
  mapBangumiBloodType,
  mapBangumiCareersToTags,
  mapBangumiCharacterRelation,
  mapBangumiGender
} from './format/roles'
import { normalizeDescription } from './format/text'
import { buildBangumiCharacterUrl, buildBangumiPersonUrl, dedupeUrls } from './format/urls'

interface BuildGameCharactersOptions {
  subjectId: number
  getSubjectCharacters: () => Promise<BangumiRelatedCharacter[]>
  getCharacterDetails: () => Promise<Map<number, BangumiCharacterDetail>>
  getCharacterPersons: () => Promise<Map<number, BangumiCharacterPerson[]>>
  locale?: Locale | undefined
}

export async function buildGameCharacters({
  subjectId,
  getSubjectCharacters,
  getCharacterDetails,
  getCharacterPersons,
  locale
}: BuildGameCharactersOptions): Promise<ScrapedGameCharacterFact[]> {
  const relatedCharacters = await getSubjectCharacters()
  if (!relatedCharacters.length) return []

  const [detailMap, characterPersonMap] = await Promise.all([
    getCharacterDetails(),
    getCharacterPersons()
  ])

  return relatedCharacters.map((character) =>
    mapGameCharacter({
      subjectId,
      relatedCharacter: character,
      detail: detailMap.get(character.id),
      characterPersons: characterPersonMap.get(character.id),
      locale
    })
  )
}

export async function fetchCharacterDetails(
  client: BangumiClient,
  ids: number[]
): Promise<Map<number, BangumiCharacterDetail>> {
  const results = await Promise.all(
    ids.map(async (characterId) => {
      try {
        const detail = await client.getCharacterById(characterId)
        if (extractImageUrls(detail.images).length === 0) {
          const fallbackImage = await client.getCharacterImageUrl(characterId, 'large')
          if (fallbackImage) {
            detail.images = { ...(detail.images ?? {}), large: fallbackImage }
          }
        }

        return [characterId, detail] as const
      } catch {
        return null
      }
    })
  )

  return new Map(
    results.filter((result): result is readonly [number, BangumiCharacterDetail] => result !== null)
  )
}

export async function fetchCharacterPersons(
  client: BangumiClient,
  ids: number[]
): Promise<Map<number, BangumiCharacterPerson[]>> {
  const results = await Promise.all(
    ids.map(async (characterId) => {
      try {
        return [characterId, await client.getCharacterPersons(characterId)] as const
      } catch {
        return null
      }
    })
  )

  return new Map(
    results.filter(
      (result): result is readonly [number, BangumiCharacterPerson[]] => result !== null
    )
  )
}

function mapGameCharacter({
  subjectId,
  relatedCharacter,
  detail,
  characterPersons,
  locale
}: {
  subjectId: number
  relatedCharacter: BangumiRelatedCharacter
  detail: BangumiCharacterDetail | undefined
  characterPersons: BangumiCharacterPerson[] | undefined
  locale?: Locale | undefined
}): ScrapedGameCharacterFact {
  const { name, originalName } = resolveLocalizedEntityName(
    detail?.name || relatedCharacter.name,
    detail?.infobox,
    locale
  )

  const characterTypeTag = mapCharacterTypeTag(detail?.type ?? relatedCharacter.type)
  const tags: ScrapedTag[] = []
  if (characterTypeTag) {
    tags.push({ name: characterTypeTag, note: 'Character Type' })
  }

  const measurements = extractCharacterMeasurementsFromInfobox(detail?.infobox)
  const persons = buildCharacterPersons(subjectId, relatedCharacter, characterPersons)
  const photos = dedupeUrls(extractImageUrls(detail?.images || relatedCharacter.images))

  return omitUndefined({
    name,
    originalName,
    description: normalizeDescription(detail?.summary || relatedCharacter.summary),
    relatedSites: [{ label: 'Bangumi', url: buildBangumiCharacterUrl(relatedCharacter.id) }],
    identity: { externalIds: [{ source: BANGUMI_SOURCE_ID, id: String(relatedCharacter.id) }] },
    photos: photos.length > 0 ? photos : undefined,
    gender: mapBangumiGender(detail?.gender),
    birthDate: toPartialDateFromParts(detail?.birth_year, detail?.birth_mon, detail?.birth_day),
    bloodType: mapBangumiBloodType(detail?.blood_type),
    height: measurements.height,
    weight: measurements.weight,
    bust: measurements.bust,
    waist: measurements.waist,
    hips: measurements.hips,
    tags: tags.length > 0 ? dedupeTags(tags) : undefined,
    type: mapBangumiCharacterRelation(relatedCharacter.relation),
    persons: persons.length > 0 ? persons : undefined
  })
}

function buildCharacterPersons(
  subjectId: number,
  relatedCharacter: BangumiRelatedCharacter,
  characterPersons: BangumiCharacterPerson[] | undefined
): ScrapedCharacterPersonFact[] {
  const persons: ScrapedCharacterPersonFact[] = []

  for (const actor of relatedCharacter.actors ?? []) {
    persons.push(
      omitUndefined({
        name: actor.name,
        originalName: actor.name,
        description: normalizeDescription(actor.short_summary),
        relatedSites: [{ label: 'Bangumi', url: buildBangumiPersonUrl(actor.id) }],
        identity: { externalIds: [{ source: BANGUMI_SOURCE_ID, id: String(actor.id) }] },
        photos: dedupeUrls(extractImageUrls(actor.images)),
        tags: mapBangumiCareersToTags(actor.career),
        type: 'actor'
      })
    )
  }

  for (const personRef of characterPersons ?? []) {
    if (
      personRef.subject_id !== subjectId ||
      personRef.subject_type !== BANGUMI_SUBJECT_TYPE_GAME
    ) {
      continue
    }

    persons.push(
      omitUndefined({
        name: personRef.name,
        originalName: personRef.name,
        relatedSites: [{ label: 'Bangumi', url: buildBangumiPersonUrl(personRef.id) }],
        identity: { externalIds: [{ source: BANGUMI_SOURCE_ID, id: String(personRef.id) }] },
        photos: dedupeUrls(extractImageUrls(personRef.images)),
        type: 'actor',
        note: personRef.staff?.trim() || undefined
      })
    )
  }

  return persons
}

function mapCharacterTypeTag(characterType: number): string | undefined {
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
