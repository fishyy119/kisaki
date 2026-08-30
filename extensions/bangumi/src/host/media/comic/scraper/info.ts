import type { ContentLocale, ScrapedComicInfo } from '@kisaki3/extension-sdk'
import type { BangumiSubject } from '../../../api/types'
import { readPositiveInteger } from '../../../utils/numbers'
import { resolveBangumiComicFormat } from '../../format/formats'
import { buildSubjectCoreInfo } from '../../subject/info'

export async function buildComicInfo(
  getSubject: () => Promise<BangumiSubject>,
  locale?: ContentLocale
): Promise<ScrapedComicInfo> {
  const [core, subject] = await Promise.all([
    buildSubjectCoreInfo(getSubject, locale),
    getSubject()
  ])

  return {
    ...core,
    format: resolveBangumiComicFormat(subject),
    totalVolumes: readPositiveInteger(subject.volumes),
    totalChapters: readTotalChapters(subject)
  }
}

/** `eps` is what a serialized entry claims; `total_episodes` counts the rows it has. */
function readTotalChapters(subject: BangumiSubject): number | undefined {
  return readPositiveInteger(subject.eps) ?? readPositiveInteger(subject.total_episodes)
}
