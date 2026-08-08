/**
 * Collection normalizers preserve slot presence: a missing collection stays
 * `undefined` ("unknown"), while a provided collection normalizes to an array
 * that may be empty ("authoritatively none").
 */

import type { RelatedSite } from '@shared/db'
import { normalizeExternalIds, normalizeKeyText, type ExternalId } from '@shared/identity'
import type { IngestUpdateLookup } from '@shared/ingest/update'
import type { Tag } from '@shared/metadata'

function uniqueByKey<T>(items: T[], keyBuilder: (item: T) => string): T[] {
  const seen = new Set<string>()
  const result: T[] = []

  for (const item of items) {
    const key = keyBuilder(item)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }

  return result
}

export function normalizeOptionalString(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function normalizeUrlCandidates(urls: string[] | null | undefined): string[] | undefined {
  if (!urls) return undefined

  return uniqueByKey(
    urls
      .map((url) => normalizeOptionalString(url))
      .filter((url): url is string => typeof url === 'string'),
    (url) => normalizeKeyText(url)
  )
}

export function pickFirstUrl(urls: string[] | null | undefined): string | undefined {
  return normalizeUrlCandidates(urls)?.[0]
}

export function normalizeRelatedSites(
  sites: RelatedSite[] | null | undefined
): RelatedSite[] | undefined {
  if (!sites) return undefined

  return uniqueByKey(
    sites
      .map((site) => {
        const url = normalizeOptionalString(site.url)
        if (!url) return null

        return {
          url,
          label: normalizeOptionalString(site.label) ?? url
        } satisfies RelatedSite
      })
      .filter((site): site is RelatedSite => site !== null),
    (site) => normalizeKeyText(site.url)
  )
}

export function normalizeTags(tagsInput: Tag[] | null | undefined): Tag[] | undefined {
  if (!tagsInput) return undefined

  return uniqueByKey(
    tagsInput
      .map((tag) => {
        const name = normalizeOptionalString(tag.name)
        if (!name) return null

        const normalizedTag: Tag = {
          name,
          isNsfw: tag.isNsfw ? true : undefined,
          isSpoiler: tag.isSpoiler ? true : undefined,
          note: normalizeOptionalString(tag.note)
        }

        return normalizedTag
      })
      .filter((tag): tag is Tag => tag !== null),
    (tag) => normalizeKeyText(tag.name)
  )
}

export function normalizeLookup(lookup: IngestUpdateLookup): {
  name: string
  knownIds: ExternalId[]
} {
  const name = normalizeOptionalString(lookup.name)
  if (!name) {
    throw new Error('Update lookup name is required')
  }

  return {
    name,
    knownIds: normalizeExternalIds(lookup.knownIds ?? [])
  }
}
