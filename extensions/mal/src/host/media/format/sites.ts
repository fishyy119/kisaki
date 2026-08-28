import type { ExternalId, ExternalSite } from '@kisaki3/extension-sdk'
import { MAL_SITE_URL, MAL_SOURCE_ID } from '../../utils/constants'
import type { MalMediaKind } from '../kinds'
import { toMalFamily } from '../kinds'

export function toMalExternalId(id: number): ExternalId {
  return { source: MAL_SOURCE_ID, id: String(id) }
}

export function malEntrySite(kind: MalMediaKind, id: number): ExternalSite {
  return { label: 'MyAnimeList', url: `${MAL_SITE_URL}/${toMalFamily(kind)}/${id}` }
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
