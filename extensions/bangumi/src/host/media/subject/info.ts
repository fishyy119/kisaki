import type { ContentLocale, PartialDate } from '@kisaki3/extension-sdk'
import type { BangumiSubject } from '../../api/types'
import { omitUndefined } from '../../utils/object'
import { parseBangumiSubjectDate } from '../format/dates'
import { resolveLocalizedSubjectName } from '../format/names'
import { normalizeDescription } from '../format/text'
import type { ExternalSite } from '../format/urls'
import { buildSubjectExternalSites } from './identity'

/** Fields every media scope reads the same way from a subject. */
export interface SubjectCoreInfo {
  name: string
  originalName?: string
  releaseDate?: PartialDate
  description?: string
  externalSites: ExternalSite[]
}

export async function buildSubjectCoreInfo(
  getSubject: () => Promise<BangumiSubject>,
  locale?: ContentLocale
): Promise<SubjectCoreInfo> {
  const subject = await getSubject()
  const { name, originalName } = resolveLocalizedSubjectName(subject.name, subject.name_cn, locale)

  return omitUndefined({
    name,
    originalName,
    releaseDate: parseBangumiSubjectDate(subject.date),
    description: normalizeDescription(subject.summary),
    externalSites: buildSubjectExternalSites(subject)
  })
}
