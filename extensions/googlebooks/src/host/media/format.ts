/**
 * Mappers from Google Books volume shapes to scraped facts.
 */

import type {
  ExternalId,
  ExternalSite,
  PartialDate,
  ScrapedNovelCompanyFact,
  ScrapedNovelPersonFact,
  ScrapedTag
} from '@kisaki3/extension-sdk'
import type { GbVolume, GbVolumeInfo } from '../api/types'
import { GBOOKS_SOURCE_ID, ISBN_SOURCE_ID } from '../utils/constants'

export function toVolumeExternalId(id: string): ExternalId {
  return { source: GBOOKS_SOURCE_ID, id }
}

/** Identity of a volume: its own id plus the ISBNs it states. */
export function buildVolumeExternalIds(volume: GbVolume): ExternalId[] {
  const ids: ExternalId[] = [toVolumeExternalId(volume.id)]
  const seen = new Set<string>()

  for (const identifier of volume.volumeInfo?.industryIdentifiers ?? []) {
    if (identifier?.type !== 'ISBN_13' && identifier?.type !== 'ISBN_10') {
      continue
    }
    const isbn = identifier.identifier?.replace(/-/g, '').trim()
    if (isbn && /^(\d{10}|\d{13})$/.test(isbn) && !seen.has(isbn)) {
      seen.add(isbn)
      ids.push({ source: ISBN_SOURCE_ID, id: isbn })
    }
  }

  return ids
}

export function buildExternalSites(info: GbVolumeInfo | null | undefined): ExternalSite[] {
  const sites: ExternalSite[] = []
  const seen = new Set<string>()

  for (const url of [info?.canonicalVolumeLink, info?.infoLink]) {
    const trimmed = url?.trim()
    if (trimmed && /^https?:\/\//i.test(trimmed) && !seen.has(trimmed)) {
      seen.add(trimmed)
      sites.push({ label: 'Google Books', url: trimmed })
    }
  }

  return sites
}

export function parsePublishedDate(value: string | null | undefined): PartialDate | undefined {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value?.trim() ?? '')
  if (!match) {
    return undefined
  }

  const year = Number(match[1])
  if (year < 1 || year > 2999) {
    return undefined
  }

  const result: PartialDate = { year }
  const month = match[2] !== undefined ? Number(match[2]) : undefined
  if (month !== undefined && month >= 1 && month <= 12) {
    result.month = month
    const day = match[3] !== undefined ? Number(match[3]) : undefined
    if (day !== undefined && day >= 1 && day <= 31) {
      result.day = day
    }
  }
  return result
}

/** Volume descriptions embed light HTML; the library stores plain text. */
export function normalizeDescription(value: string | null | undefined): string | undefined {
  const raw = value?.trim()
  if (!raw) {
    return undefined
  }

  const text = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text || undefined
}

/** BISAC category paths flatten into their distinct segments. */
export function buildTags(info: GbVolumeInfo | null | undefined): ScrapedTag[] {
  const tags: ScrapedTag[] = []
  const seen = new Set<string>()

  for (const category of info?.categories ?? []) {
    for (const segment of (category ?? '').split('/')) {
      const name = segment.trim()
      if (name && name.toLowerCase() !== 'general' && !seen.has(name)) {
        seen.add(name)
        tags.push({ name })
      }
    }
  }

  return tags
}

/** Authors are nominal facts; Google Books assigns creators no ids. */
export function buildPersonFacts(info: GbVolumeInfo | null | undefined): ScrapedNovelPersonFact[] {
  const facts: ScrapedNovelPersonFact[] = []
  const seen = new Set<string>()

  for (const name of info?.authors ?? []) {
    const trimmed = name?.trim()
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed)
      facts.push({ name: trimmed, identity: { externalIds: [] }, role: 'author' })
    }
  }

  return facts
}

export function buildCompanyFacts(
  info: GbVolumeInfo | null | undefined
): ScrapedNovelCompanyFact[] {
  const publisher = info?.publisher?.trim()
  if (!publisher) {
    return []
  }

  return [{ name: publisher, identity: { externalIds: [] }, role: 'publisher' }]
}

/**
 * Best cover art, largest first. Thumbnail URLs carry a curled-page effect
 * parameter that plain covers should not show.
 */
export function buildCovers(info: GbVolumeInfo | null | undefined): string[] {
  const links = info?.imageLinks
  const urls: string[] = []
  const seen = new Set<string>()

  for (const url of [
    links?.extraLarge,
    links?.large,
    links?.medium,
    links?.small,
    links?.thumbnail,
    links?.smallThumbnail
  ]) {
    const cleaned = url?.trim().replace(/&edge=curl/g, '')
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned)
      urls.push(cleaned)
    }
  }

  return urls
}

/** Whether the BISAC categories route this volume to the comic library. */
export function isComicVolume(info: GbVolumeInfo | null | undefined): boolean {
  return (info?.categories ?? []).some((category) =>
    (category ?? '').toLowerCase().includes('comics & graphic novels')
  )
}

/** Series membership stated by the volume, if any. */
export function readSeriesMembership(
  info: GbVolumeInfo | null | undefined
): { seriesId: string; orderNumber: number } | undefined {
  const series = info?.seriesInfo?.volumeSeries?.[0]
  const seriesId = series?.seriesId?.trim()
  if (!seriesId) {
    return undefined
  }

  const orderNumber =
    typeof series?.orderNumber === 'number' && Number.isFinite(series.orderNumber)
      ? series.orderNumber
      : Number.MAX_SAFE_INTEGER

  return { seriesId, orderNumber }
}
