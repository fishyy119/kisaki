import type { ExternalId, ScrapedEntityIdentity, ScrapedTag } from '@kisaki3/extension-sdk'
import type { BangumiSubject } from '../../api/types'
import { BANGUMI_SOURCE_ID } from '../../utils/constants'
import { dedupeExternalIds, dedupeTags } from '../format/dedupe'
import { extractExternalIdsFromSites, extractExternalSitesFromInfobox } from '../format/infobox'
import { buildBangumiSubjectUrl, dedupeExternalSites, type ExternalSite } from '../format/urls'

/** Bangumi entry link plus the outbound links its infobox declares. */
export function buildSubjectExternalSites(subject: BangumiSubject): ExternalSite[] {
  return dedupeExternalSites([
    { label: 'Bangumi', url: buildBangumiSubjectUrl(subject.id) },
    ...extractExternalSitesFromInfobox(subject.infobox)
  ])
}

export function buildSubjectExternalIds(subject: BangumiSubject): ExternalId[] {
  return dedupeExternalIds([
    { source: BANGUMI_SOURCE_ID, id: String(subject.id) },
    ...extractExternalIdsFromSites(buildSubjectExternalSites(subject))
  ])
}

export async function buildSubjectIdentity(
  getSubject: () => Promise<BangumiSubject>
): Promise<ScrapedEntityIdentity> {
  return { externalIds: buildSubjectExternalIds(await getSubject()) }
}

interface SubjectTagsOptions {
  /** Anime reads the platform as its format, so it is not tagged there. */
  includePlatform?: boolean
}

export async function buildSubjectTags(
  getSubject: () => Promise<BangumiSubject>,
  { includePlatform = false }: SubjectTagsOptions = {}
): Promise<ScrapedTag[]> {
  const subject = await getSubject()
  const tags: ScrapedTag[] = []

  if (includePlatform && subject.platform?.trim()) {
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
