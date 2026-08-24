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
import { omitUndefined } from '../../utils/object'
import {
  buildCompanyFacts,
  buildPersonFacts,
  toCompanyMetadata,
  toPersonMetadata
} from '../satellites'
import { extractImageUrls } from '../format/images'
import { composeBangumiRoleNote } from '../format/roles'

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
  const facts = buildPersonFacts(relatedPerson.id, detail, relatedPerson, locale)

  return {
    ...toPersonMetadata(facts),
    ...omitUndefined({ note: composeBangumiRoleNote(relatedPerson.relation, relatedPerson.eps) }),
    role: mapRole(relatedPerson.relation, detail?.career ?? relatedPerson.career)
  }
}

function mapSubjectCompany<TRole extends string>(
  relatedCompany: BangumiRelatedPerson,
  detail: BangumiPersonDetail | undefined,
  mapRole: (relation: string | undefined) => TRole,
  locale: ContentLocale | undefined
): SubjectCompanyFact<TRole> {
  const facts = buildCompanyFacts(relatedCompany.id, detail, relatedCompany, locale)

  return {
    ...toCompanyMetadata(facts),
    ...omitUndefined({ note: composeBangumiRoleNote(relatedCompany.relation, relatedCompany.eps) }),
    role: mapRole(relatedCompany.relation)
  }
}
