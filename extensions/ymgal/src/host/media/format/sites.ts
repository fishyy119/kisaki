import type { ExternalId, ExternalSite } from '@kisaki3/extension-sdk'
import type { YmgalWebsite } from '../../api/types'
import { YMGAL_SITE_BASE_URL, YMGAL_SOURCE_ID } from '../../utils/constants'
import { resolveHttpUrl } from './images'
import { trimToUndefined } from './text'

/** Site labels are provider names, not translatable copy. */
const YMGAL_LABEL = 'YMGal'
const GENERIC_SITE_LABEL = 'Website'

export function ymgalGameUrl(gameId: string): string {
  return `${YMGAL_SITE_BASE_URL}/ga${gameId}`
}

export function ymgalOrganizationUrl(orgId: string): string {
  return `${YMGAL_SITE_BASE_URL}/oa${orgId}`
}

export function ymgalCharacterUrl(characterId: string): string {
  return `${YMGAL_SITE_BASE_URL}/ca${characterId}`
}

export function ymgalPersonUrl(personId: string): string {
  return `${YMGAL_SITE_BASE_URL}/pa${personId}`
}

export function ymgalSite(url: string): ExternalSite {
  return { label: YMGAL_LABEL, url }
}

/** Known site names keep their canonical casing; anything else is used as-is. */
function formatSiteLabel(value: string | null | undefined): string {
  const label = trimToUndefined(value)
  if (!label) {
    return GENERIC_SITE_LABEL
  }

  switch (label.toLowerCase()) {
    case 'steam':
      return 'Steam'
    case 'wikidata':
      return 'Wikidata'
    default:
      return label
  }
}

/** Archive `website` entries as external sites, dropping unusable links. */
export function toExternalSites(
  websites: readonly YmgalWebsite[] | null | undefined
): ExternalSite[] {
  if (!websites?.length) {
    return []
  }

  return dedupeExternalSites(
    websites.map((site) => {
      const url = resolveHttpUrl(site.link)
      return url ? { label: formatSiteLabel(site.title), url } : undefined
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

    const url = resolveHttpUrl(entry.url)
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
 * Cross-source ids a linked site reveals.
 *
 * An archive links to the same work elsewhere, and those links are the only
 * place YMGal states a VNDB or Bangumi id. Reading them lets one scrape hand
 * the next provider an id instead of a name to search for.
 */
export function extractExternalIdsFromSites(sites: readonly ExternalSite[]): ExternalId[] {
  const ids: ExternalId[] = []

  for (const { url } of sites) {
    const ymgal = /https?:\/\/(?:www\.)?ymgal\.games\/[a-z]{2}(\d+)/i.exec(url)
    if (ymgal?.[1]) {
      ids.push({ source: YMGAL_SOURCE_ID, id: ymgal[1] })
    }

    const vndb = /https?:\/\/(?:www\.)?vndb\.org\/([a-z]\d+(?:\.\d+)?)/i.exec(url)
    if (vndb?.[1]) {
      ids.push({ source: 'vndb', id: vndb[1].toLowerCase() })
    }

    const bangumi = /https?:\/\/(?:bgm\.tv|bangumi\.tv|chii\.in)\/\w+\/(\d+)/i.exec(url)
    if (bangumi?.[1]) {
      ids.push({ source: 'bangumi', id: bangumi[1] })
    }

    const steam = /https?:\/\/store\.steampowered\.com\/app\/(\d+)/i.exec(url)
    if (steam?.[1]) {
      ids.push({ source: 'steam', id: steam[1] })
    }
  }

  return dedupeExternalIds(ids)
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
