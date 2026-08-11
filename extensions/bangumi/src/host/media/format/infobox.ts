import type { ExternalId } from '@kisaki3/extension-sdk'
import type { BangumiInfoboxItem, BangumiInfoboxValue } from '../../api/types'
import {
  dedupeRelatedSites,
  extractUrls,
  normalizeRelatedSiteLabel,
  type RelatedSite
} from './urls'

export function extractRelatedSitesFromInfobox(
  infobox: BangumiInfoboxItem[] | null | undefined
): RelatedSite[] {
  if (!infobox?.length) return []

  const sites: RelatedSite[] = []

  for (const item of infobox) {
    const itemLabel = normalizeRelatedSiteLabel(item.key) || 'Website'
    if (typeof item.value === 'string') {
      for (const url of extractUrls(item.value)) {
        sites.push({ label: itemLabel, url })
      }
      continue
    }

    if (!Array.isArray(item.value)) continue

    for (const entry of item.value) {
      const entryLabel = normalizeRelatedSiteLabel(entry.k) || itemLabel
      const value = entry.v?.trim()
      if (!value) continue

      for (const url of extractUrls(value)) {
        sites.push({ label: entryLabel, url })
      }
    }
  }

  return dedupeRelatedSites(sites)
}

export function extractExternalIdsFromSites(sites: RelatedSite[]): ExternalId[] {
  const externalIds: ExternalId[] = []

  for (const site of sites) {
    const url = site.url

    const vndbMatch = url.match(/https?:\/\/(?:www\.)?vndb\.org\/([a-z]\d+)/i)
    if (vndbMatch?.[1]) {
      externalIds.push({ source: 'vndb', id: vndbMatch[1] })
    }

    const steamMatch = url.match(/https?:\/\/store\.steampowered\.com\/app\/(\d+)/i)
    if (steamMatch?.[1]) {
      externalIds.push({ source: 'steam', id: steamMatch[1] })
    }

    const ymgalMatch = url.match(/https?:\/\/(?:www\.)?ymgal\.games\/[A-Z]{2}(\d+)/i)
    if (ymgalMatch?.[1]) {
      externalIds.push({ source: 'ymgal', id: ymgalMatch[1] })
    }
  }

  return externalIds
}

export function extractInfoboxValuesByKeys(
  infobox: BangumiInfoboxItem[] | null | undefined,
  keys: string[]
): string[] {
  if (!infobox?.length || keys.length === 0) {
    return []
  }

  const normalizedKeys = keys.map((key) => key.toLowerCase())
  const values: string[] = []

  for (const item of infobox) {
    const lowerKey = item.key?.toLowerCase() || ''
    if (!normalizedKeys.some((key) => lowerKey.includes(key))) continue
    values.push(...flattenInfoboxValues(item.value))
  }

  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => !isLikelyUrl(value))
}

export function extractChineseNameFromInfobox(
  infobox: BangumiInfoboxItem[] | null | undefined
): string | undefined {
  if (!infobox?.length) return undefined

  for (const item of infobox) {
    const key = item.key?.trim()
    if (!key) continue

    if (key === '简体中文名' || key === '中文名') {
      const values = flattenInfoboxValues(item.value)
      const first = values.find((value) => value.trim())
      if (first) return first.trim()
    }

    if (key === '别名' && Array.isArray(item.value)) {
      for (const entry of item.value) {
        const subKey = (entry as BangumiInfoboxValue).k?.trim()
        if (!subKey) continue
        if (subKey.includes('中文名')) {
          const value = (entry as BangumiInfoboxValue).v?.trim()
          if (value) return value
        }
      }
    }
  }

  return undefined
}

function flattenInfoboxValues(value: string | BangumiInfoboxValue[]): string[] {
  if (typeof value === 'string') {
    return [value]
  }

  if (!Array.isArray(value)) {
    return []
  }

  return value.map((entry) => entry.v?.trim()).filter((entry): entry is string => !!entry)
}

function isLikelyUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}
