import type { ContentLocale, ScrapedComicInfo } from '@kisaki3/extension-sdk'
import type { BangumiSubject } from '../../../api/types'
import { omitUndefined } from '../../../utils/object'
import { mapBangumiComicFormat } from '../../format/formats'
import { readBookVolumeCount } from '../../format/infobox'
import { buildSubjectCoreInfo } from '../../subject/info'

export async function buildComicInfo(
  getSubject: () => Promise<BangumiSubject>,
  locale?: ContentLocale
): Promise<ScrapedComicInfo> {
  const [core, subject] = await Promise.all([
    buildSubjectCoreInfo(getSubject, locale),
    getSubject()
  ])

  return omitUndefined({
    ...core,
    format: mapBangumiComicFormat(subject.platform),
    totalVolumes: readBookVolumeCount(subject.infobox),
    totalChapters: readTotalChapters(subject)
  })
}

/** `eps` is what a serialized entry claims; `total_episodes` counts the rows it has. */
function readTotalChapters(subject: BangumiSubject): number | undefined {
  for (const candidate of [subject.eps, subject.total_episodes]) {
    if (typeof candidate === 'number' && Number.isInteger(candidate) && candidate > 0) {
      return candidate
    }
  }

  return undefined
}
