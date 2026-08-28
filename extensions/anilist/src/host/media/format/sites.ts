import type { ExternalId, ExternalSite } from '@kisaki3/extension-sdk'
import type { AnilistExternalLink } from '../../api/types'
import { ANILIST_SOURCE_ID, MAL_SOURCE_ID } from '../../utils/constants'
import { trimToUndefined } from './text'

export function toAnilistExternalId(id: number): ExternalId {
  return { source: ANILIST_SOURCE_ID, id: String(id) }
}

/**
 * Identity of a media entry: its own id plus the MAL id AniList states.
 * Handing the MAL id over lets the MAL provider resolve by id instead of
 * searching by name.
 */
export function buildMediaExternalIds(id: number, idMal: number | null | undefined): ExternalId[] {
  const ids: ExternalId[] = [toAnilistExternalId(id)]
  if (typeof idMal === 'number' && Number.isInteger(idMal) && idMal > 0) {
    ids.push({ source: MAL_SOURCE_ID, id: String(idMal) })
  }
  return ids
}

export function anilistSite(url: string | null | undefined): ExternalSite | undefined {
  const value = trimToUndefined(url)
  return value ? { label: 'AniList', url: value } : undefined
}

export function externalLinkSite(link: AnilistExternalLink): ExternalSite | undefined {
  const url = trimToUndefined(link.url)
  if (!url) {
    return undefined
  }
  return { label: trimToUndefined(link.site) ?? url, url }
}

export function dedupeExternalSites(sites: readonly (ExternalSite | undefined)[]): ExternalSite[] {
  const seen = new Set<string>()
  const output: ExternalSite[] = []

  for (const site of sites) {
    if (!site || seen.has(site.url)) {
      continue
    }
    seen.add(site.url)
    output.push(site)
  }

  return output
}

export function toOptionalSites(sites: ExternalSite[]): ExternalSite[] | undefined {
  return sites.length > 0 ? sites : undefined
}

export function dedupeUrls(urls: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  const output: string[] = []

  for (const url of urls) {
    const value = url?.trim()
    if (!value || seen.has(value)) {
      continue
    }
    seen.add(value)
    output.push(value)
  }

  return output
}
