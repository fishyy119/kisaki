import type {
  Locale,
  ScrapedEntityIdentity,
  ScrapedGameInfo,
  ScrapedTag
} from '@kisaki3/extension-sdk'
import type { BangumiSubject } from '../../../api/types'
import { BANGUMI_SOURCE_ID } from '../../../utils/constants'
import { omitUndefined } from '../../../utils/object'
import { dedupeExternalIds, dedupeTags } from './format/dedupe'
import { parseBangumiSubjectDate } from './format/dates'
import { extractExternalIdsFromSites, extractRelatedSitesFromInfobox } from './format/infobox'
import { resolveLocalizedSubjectName } from './format/names'
import { normalizeDescription } from './format/text'
import { buildBangumiSubjectUrl, dedupeRelatedSites } from './format/urls'

interface BuildGameInfoOptions {
  getSubject: () => Promise<BangumiSubject>
  locale?: Locale | undefined
}

export async function buildGameInfo({
  getSubject,
  locale
}: BuildGameInfoOptions): Promise<ScrapedGameInfo> {
  const subject = await getSubject()

  const { name, originalName } = resolveLocalizedSubjectName(subject.name, subject.name_cn, locale)

  const relatedSites = dedupeRelatedSites([
    { label: 'Bangumi', url: buildBangumiSubjectUrl(subject.id) },
    ...extractRelatedSitesFromInfobox(subject.infobox)
  ])

  return omitUndefined({
    name,
    originalName,
    releaseDate: parseBangumiSubjectDate(subject.date),
    description: normalizeDescription(subject.summary),
    relatedSites
  })
}

export async function buildGameIdentity(
  getSubject: () => Promise<BangumiSubject>
): Promise<ScrapedEntityIdentity> {
  const subject = await getSubject()
  const relatedSites = dedupeRelatedSites([
    { label: 'Bangumi', url: buildBangumiSubjectUrl(subject.id) },
    ...extractRelatedSitesFromInfobox(subject.infobox)
  ])

  return {
    externalIds: dedupeExternalIds([
      { source: BANGUMI_SOURCE_ID, id: String(subject.id) },
      ...extractExternalIdsFromSites(relatedSites)
    ])
  }
}

export async function buildGameTags(
  getSubject: () => Promise<BangumiSubject>
): Promise<ScrapedTag[]> {
  const subject = await getSubject()
  const tags: ScrapedTag[] = []

  if (subject.platform?.trim()) {
    tags.push({ name: subject.platform.trim(), note: 'Platform' })
  }

  for (const metaTag of subject.meta_tags ?? []) {
    const value = metaTag?.trim()
    if (!value) continue
    tags.push({ name: value })
  }

  for (const tag of subject.tags ?? []) {
    const value = tag.name?.trim()
    if (!value) continue
    tags.push({ name: value })
  }

  return dedupeTags(tags)
}
