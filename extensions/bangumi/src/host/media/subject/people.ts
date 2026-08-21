import {
  isCancellationError,
  type ContentLocale,
  type ScrapedCompanyMetadata,
  type ScrapedPersonMetadata
} from '@kisaki3/extension-sdk'
import type { BangumiClient } from '../../api/client'
import type {
  BangumiPersonCareer,
  BangumiPersonDetail,
  BangumiRelatedPerson
} from '../../api/types'
import { BANGUMI_SOURCE_ID } from '../../utils/constants'
import { omitUndefined } from '../../utils/object'
import { dedupeExternalIds } from '../format/dedupe'
import { toPartialDateFromParts } from '../format/dates'
import {
  extractAliasesFromInfobox,
  extractExternalIdsFromSites,
  extractExternalSitesFromInfobox
} from '../format/infobox'
import { extractImageUrls } from '../format/images'
import { resolveLocalizedEntityName } from '../format/names'
import { composeBangumiRoleNote, mapBangumiCareersToTags, mapBangumiGender } from '../format/roles'
import { normalizeDescription } from '../format/text'
import { buildBangumiPersonUrl, dedupeExternalSites, dedupeUrls } from '../format/urls'

/** Person credit of a subject, before a media scope assigns its role union. */
export type SubjectPersonFact<TRole extends string> = ScrapedPersonMetadata & {
  role: TRole
  note?: string
}

export type SubjectCompanyFact<TRole extends string> = ScrapedCompanyMetadata & {
  role: TRole
  note?: string
}

interface SubjectPersonsOptions<TRole extends string> {
  getSubjectPersons: () => Promise<BangumiRelatedPerson[]>
  getPersonDetails: () => Promise<Map<number, BangumiPersonDetail>>
  mapRole: (relation: string | undefined, careers: BangumiPersonCareer[]) => TRole
  locale?: ContentLocale | undefined
}

interface SubjectCompaniesOptions<TRole extends string> {
  getSubjectPersons: () => Promise<BangumiRelatedPerson[]>
  getPersonDetails: () => Promise<Map<number, BangumiPersonDetail>>
  mapRole: (relation: string | undefined) => TRole
  locale?: ContentLocale | undefined
}

export async function buildSubjectPersons<TRole extends string>({
  getSubjectPersons,
  getPersonDetails,
  mapRole,
  locale
}: SubjectPersonsOptions<TRole>): Promise<SubjectPersonFact<TRole>[]> {
  const relatedPersons = (await getSubjectPersons()).filter((person) => person.type === 1)
  if (!relatedPersons.length) return []

  const detailMap = await getPersonDetails()

  return relatedPersons.map((relatedPerson) =>
    mapSubjectPerson(relatedPerson, detailMap.get(relatedPerson.id), mapRole, locale)
  )
}

export async function buildSubjectCompanies<TRole extends string>({
  getSubjectPersons,
  getPersonDetails,
  mapRole,
  locale
}: SubjectCompaniesOptions<TRole>): Promise<SubjectCompanyFact<TRole>[]> {
  const relatedCompanies = (await getSubjectPersons()).filter(
    (person) => person.type === 2 || person.type === 3
  )
  if (!relatedCompanies.length) return []

  const detailMap = await getPersonDetails()

  return relatedCompanies.map((relatedCompany) =>
    mapSubjectCompany(relatedCompany, detailMap.get(relatedCompany.id), mapRole, locale)
  )
}

export async function fetchPersonDetails(
  client: BangumiClient,
  ids: number[],
  signal?: AbortSignal
): Promise<Map<number, BangumiPersonDetail>> {
  const results = await Promise.all(
    ids.map(async (personId) => {
      try {
        const detail = await client.getPersonById(personId, { signal })
        if (extractImageUrls(detail.images).length === 0) {
          const fallbackImage = await client.getPersonImageUrl(personId, 'large', { signal })
          if (fallbackImage) {
            detail.images = { ...(detail.images ?? {}), large: fallbackImage }
          }
        }

        return [personId, detail] as const
      } catch (error) {
        if (isCancellationError(error)) {
          throw error
        }

        return null
      }
    })
  )

  return new Map(
    results.filter((result): result is readonly [number, BangumiPersonDetail] => result !== null)
  )
}

function mapSubjectPerson<TRole extends string>(
  relatedPerson: BangumiRelatedPerson,
  detail: BangumiPersonDetail | undefined,
  mapRole: (relation: string | undefined, careers: BangumiPersonCareer[]) => TRole,
  locale: ContentLocale | undefined
): SubjectPersonFact<TRole> {
  const { name, originalName } = resolveLocalizedEntityName(
    detail?.name || relatedPerson.name,
    detail?.infobox,
    locale
  )

  const externalSites = dedupeExternalSites([
    { label: 'Bangumi', url: buildBangumiPersonUrl(relatedPerson.id) },
    ...extractExternalSitesFromInfobox(detail?.infobox)
  ])

  const externalIds = dedupeExternalIds([
    { source: BANGUMI_SOURCE_ID, id: String(relatedPerson.id) },
    ...extractExternalIdsFromSites(externalSites)
  ])

  const photos = dedupeUrls(extractImageUrls(detail?.images || relatedPerson.images))
  const careers = detail?.career ?? relatedPerson.career
  const tags = mapBangumiCareersToTags(careers)
  const aliases = extractAliasesFromInfobox(detail?.infobox, [name, originalName])

  return {
    ...omitUndefined({
      name,
      originalName,
      aliases: aliases.length > 0 ? aliases : undefined,
      description: normalizeDescription(detail?.summary),
      externalSites,
      identity: { externalIds },
      photos: photos.length > 0 ? photos : undefined,
      tags: tags.length > 0 ? tags : undefined,
      gender: mapBangumiGender(detail?.gender),
      birthDate: toPartialDateFromParts(detail?.birth_year, detail?.birth_mon, detail?.birth_day),
      note: composeBangumiRoleNote(relatedPerson.relation, relatedPerson.eps)
    }),
    role: mapRole(relatedPerson.relation, careers)
  }
}

function mapSubjectCompany<TRole extends string>(
  relatedCompany: BangumiRelatedPerson,
  detail: BangumiPersonDetail | undefined,
  mapRole: (relation: string | undefined) => TRole,
  locale: ContentLocale | undefined
): SubjectCompanyFact<TRole> {
  const { name, originalName } = resolveLocalizedEntityName(
    detail?.name || relatedCompany.name,
    detail?.infobox,
    locale
  )

  const externalSites = dedupeExternalSites([
    { label: 'Bangumi', url: buildBangumiPersonUrl(relatedCompany.id) },
    ...extractExternalSitesFromInfobox(detail?.infobox)
  ])

  const externalIds = dedupeExternalIds([
    { source: BANGUMI_SOURCE_ID, id: String(relatedCompany.id) },
    ...extractExternalIdsFromSites(externalSites)
  ])

  const logos = dedupeUrls(extractImageUrls(detail?.images || relatedCompany.images))
  const tags = mapBangumiCareersToTags(detail?.career ?? relatedCompany.career)

  return {
    ...omitUndefined({
      name,
      originalName,
      description: normalizeDescription(detail?.summary),
      externalSites,
      identity: { externalIds },
      logos: logos.length > 0 ? logos : undefined,
      tags: tags.length > 0 ? tags : undefined,
      note: composeBangumiRoleNote(relatedCompany.relation, relatedCompany.eps)
    }),
    role: mapRole(relatedCompany.relation)
  }
}
