import type { ExternalId, ExternalSite } from '@kisaki3/extension-sdk'
import {
  IGDB_KNOWN_EXTERNAL_SOURCES,
  IGDB_SITE_BASE_URL,
  IGDB_SOURCE_ID
} from '../../utils/constants'
import { trimToUndefined } from './text'

/** Site labels are provider names, not translatable copy. */
const IGDB_LABEL = 'IGDB'
const GENERIC_SITE_LABEL = 'Website'
const YOUTUBE_LABEL = 'YouTube'

export function igdbGameUrl(gameId: number): string {
  return `${IGDB_SITE_BASE_URL}/games/${gameId}`
}

export function igdbCharacterUrl(characterId: number): string {
  return `${IGDB_SITE_BASE_URL}/characters/${characterId}`
}

export function igdbCompanyUrl(companyId: number): string {
  return `${IGDB_SITE_BASE_URL}/companies/${companyId}`
}

/** The entry's own IGDB page: its stated URL, or the canonical one. */
export function igdbSite(url: string | null | undefined, fallbackUrl: string): ExternalSite {
  return { label: IGDB_LABEL, url: trimToUndefined(url) ?? fallbackUrl }
}

export function labelledSite(
  label: string | null | undefined,
  url: string | null | undefined
): ExternalSite | undefined {
  const normalized = trimToUndefined(url)
  return normalized
    ? { label: trimToUndefined(label) ?? GENERIC_SITE_LABEL, url: normalized }
    : undefined
}

export function youtubeSite(
  name: string | null | undefined,
  videoId: string | null | undefined
): ExternalSite | undefined {
  const id = trimToUndefined(videoId)
  if (!id) {
    return undefined
  }

  const title = trimToUndefined(name)
  return {
    label: title ? `${YOUTUBE_LABEL}: ${title}` : YOUTUBE_LABEL,
    url: `https://www.youtube.com/watch?v=${id}`
  }
}

export function dedupeExternalSites(
  entries: readonly (ExternalSite | undefined)[]
): ExternalSite[] {
  const byUrl = new Map<string, ExternalSite>()

  for (const entry of entries) {
    if (!entry) {
      continue
    }

    const url = trimToUndefined(entry.url)
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
 * Normalizes an IGDB external-source name into a Kisaki id source.
 *
 * IGDB cross-references dozens of storefronts and databases; only the few the
 * library also stores ids for become external ids, so a Steam listing becomes
 * a Steam id while a regional storefront listing stays a link.
 */
export function toKnownIdSource(sourceName: string | null | undefined): string | undefined {
  const normalized = trimToUndefined(sourceName)
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return normalized && IGDB_KNOWN_EXTERNAL_SOURCES.has(normalized) ? normalized : undefined
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

export function toIgdbExternalId(id: number): ExternalId {
  return { source: IGDB_SOURCE_ID, id: String(id) }
}
