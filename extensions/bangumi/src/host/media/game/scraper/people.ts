import type {
  ContentLocale,
  ScrapedGameCompanyFact,
  ScrapedGamePersonFact
} from '@kisaki3/extension-sdk'
import type { BangumiClient } from '../../../api/client'
import type { BangumiPersonDetail, BangumiRelatedPerson } from '../../../api/types'
import { BANGUMI_SOURCE_ID } from '../../../utils/constants'
import { omitUndefined } from '../../../utils/object'
import { dedupeExternalIds } from './format/dedupe'
import { toPartialDateFromParts } from './format/dates'
import { extractExternalIdsFromSites, extractRelatedSitesFromInfobox } from './format/infobox'
import { extractImageUrls } from './format/images'
import { resolveLocalizedEntityName } from './format/names'
import {
  composeBangumiRoleNote,
  mapBangumiCareersToTags,
  mapBangumiCompanyRole,
  mapBangumiGender,
  mapBangumiPersonRole
} from './format/roles'
import { normalizeDescription } from './format/text'
import { buildBangumiPersonUrl, dedupeRelatedSites, dedupeUrls } from './format/urls'

export async function buildGamePersons(
  getSubjectPersons: () => Promise<BangumiRelatedPerson[]>,
  getPersonDetails: () => Promise<Map<number, BangumiPersonDetail>>,
  locale?: ContentLocale | undefined
): Promise<ScrapedGamePersonFact[]> {
  const relatedPersons = (await getSubjectPersons()).filter((person) => person.type === 1)
  if (!relatedPersons.length) return []

  const detailMap = await getPersonDetails()

  return relatedPersons.map((relatedPerson) =>
    mapGamePerson(relatedPerson, detailMap.get(relatedPerson.id), locale)
  )
}

export async function buildGameCompanies(
  getSubjectPersons: () => Promise<BangumiRelatedPerson[]>,
  getPersonDetails: () => Promise<Map<number, BangumiPersonDetail>>,
  locale?: ContentLocale
): Promise<ScrapedGameCompanyFact[]> {
  const relatedCompanies = (await getSubjectPersons()).filter(
    (person) => person.type === 2 || person.type === 3
  )
  if (!relatedCompanies.length) return []

  const detailMap = await getPersonDetails()

  return relatedCompanies.map((relatedCompany) =>
    mapGameCompany(relatedCompany, detailMap.get(relatedCompany.id), locale)
  )
}

export async function fetchPersonDetails(
  client: BangumiClient,
  ids: number[]
): Promise<Map<number, BangumiPersonDetail>> {
  const results = await Promise.all(
    ids.map(async (personId) => {
      try {
        const detail = await client.getPersonById(personId)
        if (extractImageUrls(detail.images).length === 0) {
          const fallbackImage = await client.getPersonImageUrl(personId, 'large')
          if (fallbackImage) {
            detail.images = { ...(detail.images ?? {}), large: fallbackImage }
          }
        }

        return [personId, detail] as const
      } catch {
        return null
      }
    })
  )

  return new Map(
    results.filter((result): result is readonly [number, BangumiPersonDetail] => result !== null)
  )
}

function mapGamePerson(
  relatedPerson: BangumiRelatedPerson,
  detail: BangumiPersonDetail | undefined,
  locale?: ContentLocale
): ScrapedGamePersonFact {
  const { name, originalName } = resolveLocalizedEntityName(
    detail?.name || relatedPerson.name,
    detail?.infobox,
    locale
  )

  const relatedSites = dedupeRelatedSites([
    { label: 'Bangumi', url: buildBangumiPersonUrl(relatedPerson.id) },
    ...extractRelatedSitesFromInfobox(detail?.infobox)
  ])

  const externalIds = dedupeExternalIds([
    { source: BANGUMI_SOURCE_ID, id: String(relatedPerson.id) },
    ...extractExternalIdsFromSites(relatedSites)
  ])

  const photos = dedupeUrls(extractImageUrls(detail?.images || relatedPerson.images))
  const careers = detail?.career ?? relatedPerson.career

  const tags = mapBangumiCareersToTags(careers)
  const type = mapBangumiPersonRole(relatedPerson.relation, careers)

  return omitUndefined({
    name,
    originalName,
    description: normalizeDescription(detail?.summary),
    relatedSites,
    identity: { externalIds },
    photos: photos.length > 0 ? photos : undefined,
    tags: tags.length > 0 ? tags : undefined,
    gender: mapBangumiGender(detail?.gender),
    birthDate: toPartialDateFromParts(detail?.birth_year, detail?.birth_mon, detail?.birth_day),
    type,
    note: composeBangumiRoleNote(relatedPerson.relation, relatedPerson.eps)
  })
}

function mapGameCompany(
  relatedCompany: BangumiRelatedPerson,
  detail: BangumiPersonDetail | undefined,
  locale?: ContentLocale | undefined
): ScrapedGameCompanyFact {
  const { name, originalName } = resolveLocalizedEntityName(
    detail?.name || relatedCompany.name,
    detail?.infobox,
    locale
  )

  const relatedSites = dedupeRelatedSites([
    { label: 'Bangumi', url: buildBangumiPersonUrl(relatedCompany.id) },
    ...extractRelatedSitesFromInfobox(detail?.infobox)
  ])

  const externalIds = dedupeExternalIds([
    { source: BANGUMI_SOURCE_ID, id: String(relatedCompany.id) },
    ...extractExternalIdsFromSites(relatedSites)
  ])

  const logos = dedupeUrls(extractImageUrls(detail?.images || relatedCompany.images))
  const tags = mapBangumiCareersToTags(detail?.career ?? relatedCompany.career)

  return omitUndefined({
    name,
    originalName,
    description: normalizeDescription(detail?.summary),
    relatedSites,
    identity: { externalIds },
    logos: logos.length > 0 ? logos : undefined,
    tags: tags.length > 0 ? tags : undefined,
    type: mapBangumiCompanyRole(relatedCompany.relation),
    note: composeBangumiRoleNote(relatedCompany.relation, relatedCompany.eps)
  })
}
