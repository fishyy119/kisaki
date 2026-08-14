import type { ContentLocale, ScrapedAnimeInfo } from '@kisaki3/extension-sdk'
import type { BangumiSubject } from '../../../api/types'
import { omitUndefined } from '../../../utils/object'
import { mapBangumiAnimeFormat } from '../../format/formats'
import { buildSubjectCoreInfo } from '../../subject/info'

export async function buildAnimeInfo(
  getSubject: () => Promise<BangumiSubject>,
  locale?: ContentLocale
): Promise<ScrapedAnimeInfo> {
  const [core, subject] = await Promise.all([
    buildSubjectCoreInfo(getSubject, locale),
    getSubject()
  ])

  return omitUndefined({
    ...core,
    format: mapBangumiAnimeFormat(subject.platform),
    totalEpisodes: readTotalEpisodes(subject)
  })
}

/** `eps` is what the entry claims; `total_episodes` counts the rows it has. */
function readTotalEpisodes(subject: BangumiSubject): number | undefined {
  for (const candidate of [subject.eps, subject.total_episodes]) {
    if (typeof candidate === 'number' && Number.isInteger(candidate) && candidate > 0) {
      return candidate
    }
  }

  return undefined
}
