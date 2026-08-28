/**
 * Mappers from NeoDB catalog shapes to scraped facts: localized text
 * selection, cross-source identifier extraction, and credit building.
 */

import type {
  ContentLocale,
  ExternalId,
  ExternalSite,
  PartialDate,
  ScrapedNovelCompanyFact,
  ScrapedNovelPersonFact
} from '@kisaki3/extension-sdk'
import type { NdBook, NdItem, NdLocalizedText } from '../api/types'
import {
  BANGUMI_SOURCE_ID,
  DOUBAN_SOURCE_ID,
  GOODREADS_SOURCE_ID,
  ISBN_SOURCE_ID,
  NEODB_SOURCE_ID,
  OPENLIBRARY_SOURCE_ID
} from '../utils/constants'

/** NeoDB language codes acceptable for each content locale, best first. */
const ND_LOCALE_CANDIDATES: Partial<Record<ContentLocale, readonly string[]>> = {
  'zh-Hans': ['zh-cn', 'zh-hans', 'zh'],
  'zh-Hant': ['zh-tw', 'zh-hk', 'zh-hant'],
  en: ['en'],
  ja: ['ja']
}

export function pickLocalizedText(
  entries: readonly NdLocalizedText[] | null | undefined,
  locale: ContentLocale
): string | undefined {
  if (!entries || entries.length === 0) {
    return undefined
  }

  const candidates = ND_LOCALE_CANDIDATES[locale] ?? [locale.toLowerCase()]
  for (const candidate of candidates) {
    for (const entry of entries) {
      if (entry.lang?.trim().toLowerCase() === candidate && entry.text?.trim()) {
        return entry.text.trim()
      }
    }
  }

  return undefined
}

export function toNeodbExternalId(uuid: string): ExternalId {
  return { source: NEODB_SOURCE_ID, id: uuid }
}

const RESOURCE_ID_PATTERNS: readonly { source: string; pattern: RegExp }[] = [
  { source: DOUBAN_SOURCE_ID, pattern: /douban\.com\/subject\/(\d+)/ },
  { source: BANGUMI_SOURCE_ID, pattern: /bgm\.tv\/subject\/(\d+)/ },
  { source: GOODREADS_SOURCE_ID, pattern: /goodreads\.com\/book\/show\/(\d+)/ },
  { source: OPENLIBRARY_SOURCE_ID, pattern: /openlibrary\.org\/books\/(OL\w+)/ }
]

/**
 * Identity of a book entry: the NeoDB id, the ISBN (the shared cross-source
 * book id), and every recognized identifier its external resources state.
 */
export function buildBookExternalIds(book: NdBook): ExternalId[] {
  const ids: ExternalId[] = [toNeodbExternalId(book.uuid)]

  const isbn = book.isbn?.replace(/-/g, '').trim()
  if (isbn && /^(\d{10}|\d{13})$/.test(isbn)) {
    ids.push({ source: ISBN_SOURCE_ID, id: isbn })
  }

  const seen = new Set(ids.map((entry) => `${entry.source}:${entry.id}`))
  for (const resource of book.external_resources ?? []) {
    const url = resource.url?.trim()
    if (!url) {
      continue
    }

    for (const { source, pattern } of RESOURCE_ID_PATTERNS) {
      const match = pattern.exec(url)
      if (match?.[1] && !seen.has(`${source}:${match[1]}`)) {
        seen.add(`${source}:${match[1]}`)
        ids.push({ source, id: match[1] })
      }
    }
  }

  return ids
}

export function buildExternalSites(book: NdBook, instanceUrl: string): ExternalSite[] {
  const sites: ExternalSite[] = []
  const seen = new Set<string>()

  const path = book.url?.trim()
  if (path) {
    const url = path.startsWith('http') ? path : `${instanceUrl}${path}`
    sites.push({ label: 'NeoDB', url })
    seen.add(url)
  }

  for (const resource of book.external_resources ?? []) {
    const url = resource.url?.trim()
    if (!url || seen.has(url)) {
      continue
    }
    seen.add(url)
    sites.push({ label: resourceLabel(url), url })
  }

  return sites
}

function resourceLabel(url: string): string {
  if (url.includes('douban.com')) {
    return 'Douban'
  }
  if (url.includes('bgm.tv')) {
    return 'Bangumi'
  }
  if (url.includes('goodreads.com')) {
    return 'Goodreads'
  }
  if (url.includes('openlibrary.org')) {
    return 'Open Library'
  }
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export function buildReleaseDate(book: NdBook): PartialDate | undefined {
  const year = book.pub_year
  if (typeof year !== 'number' || !Number.isInteger(year) || year <= 0) {
    return undefined
  }

  const result: PartialDate = { year }
  const month = book.pub_month
  if (typeof month === 'number' && Number.isInteger(month) && month >= 1 && month <= 12) {
    result.month = month
  }
  return result
}

/**
 * Author and translator credits. NeoDB assigns creators no ids, so these are
 * nominal facts matched by name downstream.
 */
export function buildPersonFacts(book: NdBook): ScrapedNovelPersonFact[] {
  const facts: ScrapedNovelPersonFact[] = []
  const seen = new Set<string>()

  for (const name of book.author ?? []) {
    const trimmed = name?.trim()
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed)
      facts.push({ name: trimmed, identity: { externalIds: [] }, role: 'author' })
    }
  }
  for (const name of book.translator ?? []) {
    const trimmed = name?.trim()
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed)
      facts.push({
        name: trimmed,
        identity: { externalIds: [] },
        role: 'other',
        note: 'Translator'
      })
    }
  }

  return facts
}

export function buildCompanyFacts(book: NdBook): ScrapedNovelCompanyFact[] {
  const facts: ScrapedNovelCompanyFact[] = []

  const publisher = book.pub_house?.trim()
  if (publisher) {
    facts.push({ name: publisher, identity: { externalIds: [] }, role: 'publisher' })
  }

  const imprint = book.imprint?.trim()
  if (imprint && imprint !== publisher) {
    facts.push({ name: imprint, identity: { externalIds: [] }, role: 'imprint' })
  }

  return facts
}

/** Display name of an item for search results and lookups. */
export function pickItemTitle(item: NdItem, locale: ContentLocale): string | undefined {
  return (
    pickLocalizedText(item.localized_title, locale) ??
    item.display_title?.trim() ??
    item.title?.trim() ??
    undefined
  )
}
