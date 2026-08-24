import {
  isCancellationError,
  type ContentLocale,
  type ScrapedCharacterMetadata,
  type ScrapedCharacterPersonFact
} from '@kisaki3/extension-sdk'
import type { BangumiClient } from '../../api/client'
import type {
  BangumiCharacterDetail,
  BangumiCharacterPerson,
  BangumiRelatedCharacter,
  BangumiSubjectType
} from '../../api/types'
import { BANGUMI_SOURCE_ID } from '../../utils/constants'
import { omitUndefined } from '../../utils/object'
import { BANGUMI_LABEL, buildCharacterFacts, toCharacterMetadata } from '../satellites'
import { extractImageUrls } from '../format/images'
import {
  mapBangumiCareersToTags,
  mapBangumiCharacterRole,
  type BangumiCharacterRole
} from '../format/roles'
import { normalizeDescription } from '../format/text'
import { buildBangumiPersonUrl, dedupeUrls } from '../format/urls'

/** Character credit of a subject; game and anime share the role union. */
export type SubjectCharacterFact = ScrapedCharacterMetadata & {
  role: BangumiCharacterRole
  note?: string
}

interface SubjectCharactersOptions {
  subjectId: number
  subjectType: BangumiSubjectType
  getSubjectCharacters: () => Promise<BangumiRelatedCharacter[]>
  getCharacterDetails: () => Promise<Map<number, BangumiCharacterDetail>>
  getCharacterPersons: () => Promise<Map<number, BangumiCharacterPerson[]>>
  locale?: ContentLocale | undefined
}

export async function buildSubjectCharacters({
  subjectId,
  subjectType,
  getSubjectCharacters,
  getCharacterDetails,
  getCharacterPersons,
  locale
}: SubjectCharactersOptions): Promise<SubjectCharacterFact[]> {
  const relatedCharacters = await getSubjectCharacters()
  if (!relatedCharacters.length) return []

  const [detailMap, characterPersonMap] = await Promise.all([
    getCharacterDetails(),
    getCharacterPersons()
  ])

  return relatedCharacters.map((character) =>
    mapSubjectCharacter({
      subjectId,
      subjectType,
      relatedCharacter: character,
      detail: detailMap.get(character.id),
      characterPersons: characterPersonMap.get(character.id),
      locale
    })
  )
}

export async function fetchCharacterDetails(
  client: BangumiClient,
  ids: number[],
  signal?: AbortSignal
): Promise<Map<number, BangumiCharacterDetail>> {
  const results = await Promise.all(
    ids.map(async (characterId) => {
      try {
        const detail = await client.getCharacterById(characterId, { signal })
        if (extractImageUrls(detail.images).length === 0) {
          const fallbackImage = await client.getCharacterImageUrl(characterId, 'large', { signal })
          if (fallbackImage) {
            detail.images = { ...(detail.images ?? {}), large: fallbackImage }
          }
        }

        return [characterId, detail] as const
      } catch (error) {
        if (isCancellationError(error)) {
          throw error
        }

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
  ids: number[],
  signal?: AbortSignal
): Promise<Map<number, BangumiCharacterPerson[]>> {
  const results = await Promise.all(
    ids.map(async (characterId) => {
      try {
        return [characterId, await client.getCharacterPersons(characterId, { signal })] as const
      } catch (error) {
        if (isCancellationError(error)) {
          throw error
        }

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

function mapSubjectCharacter({
  subjectId,
  subjectType,
  relatedCharacter,
  detail,
  characterPersons,
  locale
}: {
  subjectId: number
  subjectType: BangumiSubjectType
  relatedCharacter: BangumiRelatedCharacter
  detail: BangumiCharacterDetail | undefined
  characterPersons: BangumiCharacterPerson[] | undefined
  locale: ContentLocale | undefined
}): SubjectCharacterFact {
  const facts = buildCharacterFacts(relatedCharacter.id, detail, relatedCharacter, locale)
  const persons = buildCharacterPersons(subjectId, subjectType, relatedCharacter, characterPersons)

  return omitUndefined({
    ...toCharacterMetadata(facts),
    role: mapBangumiCharacterRole(relatedCharacter.relation),
    persons: persons.length > 0 ? persons : undefined
  })
}

function buildCharacterPersons(
  subjectId: number,
  subjectType: BangumiSubjectType,
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
        externalSites: [{ label: BANGUMI_LABEL, url: buildBangumiPersonUrl(actor.id) }],
        identity: { externalIds: [{ source: BANGUMI_SOURCE_ID, id: String(actor.id) }] },
        photos: dedupeUrls(extractImageUrls(actor.images)),
        tags: mapBangumiCareersToTags(actor.career),
        role: 'actor'
      })
    )
  }

  for (const personRef of characterPersons ?? []) {
    if (personRef.subject_id !== subjectId || personRef.subject_type !== subjectType) {
      continue
    }

    persons.push(
      omitUndefined({
        name: personRef.name,
        originalName: personRef.name,
        externalSites: [{ label: BANGUMI_LABEL, url: buildBangumiPersonUrl(personRef.id) }],
        identity: { externalIds: [{ source: BANGUMI_SOURCE_ID, id: String(personRef.id) }] },
        photos: dedupeUrls(extractImageUrls(personRef.images)),
        role: 'actor',
        note: personRef.staff?.trim() || undefined
      })
    )
  }

  return persons
}
