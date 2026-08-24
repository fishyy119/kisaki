import type { ExternalId, ExternalSite } from '@kisaki3/extension-sdk'
import type { VndbExtlink, VndbImage } from '../../api/types'
import { VNDB_SITE_BASE_URL, VNDB_SOURCE_ID } from '../../utils/constants'
import { trimToUndefined } from './text'

/** Site labels are provider names, not translatable copy. */
const VNDB_LABEL = 'VNDB'
const GENERIC_SITE_LABEL = 'Website'

/**
 * External-link names VNDB uses, mapped to the id sources Kisaki stores.
 *
 * A link's own name is authoritative about which site it points at, so when a
 * link is named, only the id matching that site is taken from it.
 */
const EXTLINK_SOURCES: Record<string, string> = {
  bgmtv: 'bangumi',
  steam: 'steam',
  igdb: 'igdb',
  ymgal: 'ymgal',
  vndb: VNDB_SOURCE_ID
}

/** Every VNDB entity kind lives under the same one-segment path. */
export function vndbEntryUrl(id: string): string {
  return `${VNDB_SITE_BASE_URL}/${id}`
}

export function vndbSite(id: string): ExternalSite {
  return { label: VNDB_LABEL, url: vndbEntryUrl(id) }
}

export function normalizeUrl(value: string | null | undefined): string | undefined {
  const raw = trimToUndefined(value)
  if (!raw) {
    return undefined
  }

  try {
    return new URL(raw).toString()
  } catch {
    return undefined
  }
}

export function toExternalSites(
  extlinks: readonly VndbExtlink[] | null | undefined
): ExternalSite[] {
  if (!extlinks?.length) {
    return []
  }

  return dedupeExternalSites(
    extlinks.map((entry) => {
      const url = normalizeUrl(entry.url)
      if (!url) {
        return undefined
      }

      return {
        label: trimToUndefined(entry.label) ?? trimToUndefined(entry.name) ?? GENERIC_SITE_LABEL,
        url
      }
    })
  )
}

export function dedupeExternalSites(
  entries: readonly (ExternalSite | undefined)[]
): ExternalSite[] {
  const byUrl = new Map<string, ExternalSite>()

  for (const entry of entries) {
    if (!entry) {
      continue
    }

    const url = normalizeUrl(entry.url)
    if (!url || byUrl.has(url)) {
      continue
    }

    byUrl.set(url, { label: trimToUndefined(entry.label) ?? GENERIC_SITE_LABEL, url })
  }

  return [...byUrl.values()]
}

export function toOptionalSites(sites: readonly ExternalSite[]): ExternalSite[] | undefined {
  return sites.length > 0 ? [...sites] : undefined
}

/**
 * Cross-source ids the entry's external links reveal.
 *
 * The links are the only place VNDB states a Steam, Bangumi, or YMGal id, so
 * reading them lets one scrape hand the next provider an id instead of a name.
 */
export function extractExternalIdsFromExtlinks(
  extlinks: readonly VndbExtlink[] | null | undefined
): ExternalId[] {
  const ids: ExternalId[] = []

  for (const extlink of extlinks ?? []) {
    const url = normalizeUrl(extlink.url)
    if (!url) {
      continue
    }

    const matches = matchExternalIds(url)
    if (matches.length === 0) {
      continue
    }

    const declaredSource = EXTLINK_SOURCES[trimToUndefined(extlink.name)?.toLowerCase() ?? '']
    ids.push(
      ...(declaredSource ? matches.filter((match) => match.source === declaredSource) : matches)
    )
  }

  return dedupeExternalIds(ids)
}

function matchExternalIds(url: string): ExternalId[] {
  const matched: ExternalId[] = []

  const vndb = /https?:\/\/(?:www\.)?vndb\.org\/([a-z]\d+(?:\.\d+)?)/i.exec(url)
  if (vndb?.[1]) {
    matched.push({ source: VNDB_SOURCE_ID, id: vndb[1].toLowerCase() })
  }

  const steam = /https?:\/\/store\.steampowered\.com\/app\/(\d+)/i.exec(url)
  if (steam?.[1]) {
    matched.push({ source: 'steam', id: steam[1] })
  }

  const bangumi = /https?:\/\/(?:bgm\.tv|bangumi\.tv|chii\.in)\/\w+\/(\d+)/i.exec(url)
  if (bangumi?.[1]) {
    matched.push({ source: 'bangumi', id: bangumi[1] })
  }

  const ymgal = /https?:\/\/(?:www\.)?ymgal\.games\/[a-z]{2}(\d+)/i.exec(url)
  if (ymgal?.[1]) {
    matched.push({ source: 'ymgal', id: ymgal[1] })
  }

  return matched
}

export function dedupeExternalIds(ids: readonly ExternalId[]): ExternalId[] {
  const seen = new Set<string>()
  const output: ExternalId[] = []

  for (const entry of ids) {
    const source = trimToUndefined(entry.source)?.toLowerCase()
    const id = trimToUndefined(entry.id)
    if (!source || !id) {
      continue
    }

    const key = `${source}:${id}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    output.push({ source, id })
  }

  return output
}

/** Image URLs in source order, deduplicated. */
export function dedupeImageUrls(
  images: readonly (VndbImage | string | null | undefined)[]
): string[] {
  const seen = new Set<string>()
  const output: string[] = []

  for (const image of images) {
    const candidates =
      typeof image === 'string' || image === null || image === undefined
        ? [image]
        : [image.url, image.thumbnail]

    for (const candidate of candidates) {
      const url = normalizeUrl(candidate)
      if (!url || seen.has(url)) {
        continue
      }
      seen.add(url)
      output.push(url)
    }
  }

  return output
}
