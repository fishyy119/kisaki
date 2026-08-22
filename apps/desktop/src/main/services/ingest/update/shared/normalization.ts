/**
 * Collection normalizers preserve slot presence: a missing collection stays
 * `undefined` ("unknown"), while a provided collection normalizes to an array
 * that may be empty ("authoritatively none").
 */

import type { ExternalSite } from '@shared/db'
import { normalizeExternalIds, normalizeKeyText } from '@shared/identity'
import type { ScraperLookup } from '@shared/scraper'
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

export function normalizeExternalSites(
  sites: ExternalSite[] | null | undefined
): ExternalSite[] | undefined {
  if (!sites) return undefined

  return uniqueByKey(
    sites
      .map((site) => {
        const url = normalizeOptionalString(site.url)
        if (!url) return null

        return {
          url,
          label: normalizeOptionalString(site.label) ?? url
        } satisfies ExternalSite
      })
      .filter((site): site is ExternalSite => site !== null),
    (site) => normalizeKeyText(site.url)
  )
}

export function normalizeAliases(aliases: string[] | null | undefined): string[] | undefined {
  if (!aliases) return undefined

  return uniqueByKey(
    aliases
      .map((alias) => normalizeOptionalString(alias))
      .filter((alias): alias is string => typeof alias === 'string'),
    (alias) => normalizeKeyText(alias)
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

export function normalizeLookup<TLookup extends ScraperLookup>(lookup: TLookup): TLookup {
  const name = normalizeOptionalString(lookup.name)
  if (!name) {
    throw new Error('Update lookup name is required')
  }

  return {
    ...lookup,
    name,
    knownIds: normalizeExternalIds(lookup.knownIds)
  }
}
