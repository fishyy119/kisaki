import type { ContentLocale, ScrapedNovelInfo } from '@kisaki3/extension-sdk'
import type { BangumiSubject } from '../../../api/types'
import { omitUndefined } from '../../../utils/object'
import { readPositiveInteger } from '../../../utils/numbers'
import { mapBangumiNovelFormat } from '../../format/formats'
import { buildSubjectCoreInfo } from '../../subject/info'

export async function buildNovelInfo(
  getSubject: () => Promise<BangumiSubject>,
  locale?: ContentLocale
): Promise<ScrapedNovelInfo> {
  const [core, subject] = await Promise.all([
    buildSubjectCoreInfo(getSubject, locale),
    getSubject()
  ])

  return omitUndefined({
    ...core,
    format: mapBangumiNovelFormat(subject.platform),
    totalVolumes: readPositiveInteger(subject.volumes)
  })
}
