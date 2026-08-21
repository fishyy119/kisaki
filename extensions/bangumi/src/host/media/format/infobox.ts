import type { ExternalId } from '@kisaki3/extension-sdk'
import type { BangumiInfoboxItem, BangumiInfoboxValue } from '../../api/types'
import {
  dedupeExternalSites,
  extractUrls,
  normalizeExternalSiteLabel,
  type ExternalSite
} from './urls'

export function extractExternalSitesFromInfobox(
  infobox: BangumiInfoboxItem[] | null | undefined
): ExternalSite[] {
  if (!infobox?.length) return []

  const sites: ExternalSite[] = []

  for (const item of infobox) {
    const itemLabel = normalizeExternalSiteLabel(item.key) || 'Website'
    if (typeof item.value === 'string') {
      for (const url of extractUrls(item.value)) {
        sites.push({ label: itemLabel, url })
      }
      continue
    }

    if (!Array.isArray(item.value)) continue

    for (const entry of item.value) {
      const entryLabel = normalizeExternalSiteLabel(entry.k) || itemLabel
      const value = entry.v?.trim()
      if (!value) continue

      for (const url of extractUrls(value)) {
        sites.push({ label: entryLabel, url })
      }
    }
  }

  return dedupeExternalSites(sites)
}

export function extractExternalIdsFromSites(sites: ExternalSite[]): ExternalId[] {
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

/**
 * Infobox keys that hold alternative names.
 *
 * Bangumi files every spelling a work or a person is also known by under these
 * keys: romanizations, the pen name a writer credits scenario under, the
 * nickname a character is called in-story.
 */
const ALIAS_KEYS = new Set(['别名', '又名', '昵称', '本名'])

/**
 * Alternative names stated by an infobox.
 *
 * `exclude` drops the spellings the entity already carries as its name, so an
 * alias list never repeats what is displayed next to it. Nested entries keep
 * only their value: the sub-key names which kind of alias it is, which the
 * alias list itself does not record.
 */
export function extractAliasesFromInfobox(
  infobox: BangumiInfoboxItem[] | null | undefined,
  exclude: readonly (string | undefined)[] = []
): string[] {
  if (!infobox?.length) {
    return []
  }

  const excluded = new Set(
    exclude.map((value) => value?.trim()).filter((value): value is string => !!value)
  )
  const aliases = new Set<string>()

  for (const item of infobox) {
    if (!ALIAS_KEYS.has(item.key?.trim() ?? '')) {
      continue
    }

    for (const value of flattenInfoboxValues(item.value)) {
      const alias = value.trim()
      if (alias && !isLikelyUrl(alias) && !excluded.has(alias)) {
        aliases.add(alias)
      }
    }
  }

  return [...aliases]
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
