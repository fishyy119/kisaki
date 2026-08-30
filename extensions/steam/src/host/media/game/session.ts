/**
 * Game session: one localized appdetails read answers info, tags, companies,
 * DLC relations, and art. Covers come from the library capsule assets (with
 * the store header as fallback), backdrops from the hero asset and
 * screenshots. Steam states no per-person or character credits.
 */

import type {
  ContentLocale,
  GameScraperSession,
  GameScraperSlot,
  GameSessionResultMap,
  PartialDate,
  ScrapedEntityIdentity,
  ScrapedGameCompanyFact,
  ScrapedGameInfo,
  ScrapedRelatedEntryFact,
  ScrapedTag
} from '@kisaki3/extension-sdk'
import type { SteamClient } from '../../api/client'
import type { SteamAppDetails } from '../../api/types'
import { STEAM_ASSETS_URL, STEAM_SOURCE_ID, STEAM_STORE_PAGE_URL } from '../../utils/constants'
import { toSteamLanguage } from '../locales'

export function createSteamGameSession(
  client: SteamClient,
  appId: number,
  locale: ContentLocale,
  signal: AbortSignal
): GameScraperSession {
  const getDetails = memoize(() => client.getAppDetails(appId, toSteamLanguage(locale), { signal }))
  const tasks = new Map<GameScraperSlot, Promise<unknown>>()

  const loadSlot = async (slot: GameScraperSlot): Promise<unknown> => {
    switch (slot) {
      case 'info':
        return buildInfo(appId, await getDetails())
      case 'tags':
        return buildTags(await getDetails())
      case 'companies':
        return buildCompanies(await getDetails())
      case 'relatedEntries':
        return buildRelatedEntries(await getDetails())
      case 'covers':
        return buildCovers(appId, await getDetails())
      case 'backdrops':
        return buildBackdrops(appId, await getDetails())
      case 'characters':
      case 'persons':
      case 'logos':
      case 'icons':
        return undefined
    }
  }

  return {
    get: async (slots) => {
      const output: Partial<GameSessionResultMap> = {}

      await Promise.all(
        slots.map(async (slot) => {
          if (!tasks.has(slot)) {
            tasks.set(slot, loadSlot(slot))
          }

          const payload = await tasks.get(slot)!
          if (payload !== undefined) {
            ;(output as Record<GameScraperSlot, unknown>)[slot] = payload
          }
        })
      )

      return { identity: buildIdentity(appId), slots: output }
    }
  }
}

function buildIdentity(appId: number): ScrapedEntityIdentity {
  return { externalIds: [{ source: STEAM_SOURCE_ID, id: String(appId) }] }
}

function buildInfo(appId: number, details: SteamAppDetails): ScrapedGameInfo | undefined {
  const name = details.name?.trim()
  if (!name) {
    return undefined
  }

  const sites = [{ label: 'Steam', url: `${STEAM_STORE_PAGE_URL}/${appId}` }]
  const website = details.website?.trim()
  if (website && /^https?:\/\//i.test(website)) {
    sites.push({ label: 'Official website', url: website })
  }

  return {
    name,
    releaseDate: parseReleaseDate(details.release_date?.date),
    description: normalizeDescription(details.short_description ?? details.about_the_game),
    externalSites: sites
  }
}

/** Genres are editorial; categories are store features worth keeping as tags. */
function buildTags(details: SteamAppDetails): ScrapedTag[] {
  const tags: ScrapedTag[] = []
  const seen = new Set<string>()

  for (const entry of [...(details.genres ?? []), ...(details.categories ?? [])]) {
    const name = entry?.description?.trim()
    if (!name || seen.has(name)) {
      continue
    }
    seen.add(name)
    tags.push({ name })
  }

  return tags
}

/**
 * Developer and publisher names. Steam assigns companies no stable ids, so
 * these are nominal facts with an empty identity; ingest matches them by name.
 */
function buildCompanies(details: SteamAppDetails): ScrapedGameCompanyFact[] {
  const facts: ScrapedGameCompanyFact[] = []
  const seen = new Set<string>()

  for (const name of details.developers ?? []) {
    const trimmed = name?.trim()
    if (trimmed && !seen.has(`developer:${trimmed}`)) {
      seen.add(`developer:${trimmed}`)
      facts.push({ name: trimmed, identity: { externalIds: [] }, role: 'developer' })
    }
  }
  for (const name of details.publishers ?? []) {
    const trimmed = name?.trim()
    if (trimmed && !seen.has(`publisher:${trimmed}`)) {
      seen.add(`publisher:${trimmed}`)
      facts.push({ name: trimmed, identity: { externalIds: [] }, role: 'publisher' })
    }
  }

  return facts
}

function buildRelatedEntries(details: SteamAppDetails): ScrapedRelatedEntryFact[] {
  const facts: ScrapedRelatedEntryFact[] = []

  for (const dlcId of details.dlc ?? []) {
    if (Number.isInteger(dlcId) && dlcId > 0) {
      facts.push({
        mediaType: 'game',
        source: STEAM_SOURCE_ID,
        externalId: String(dlcId),
        type: 'sideStory',
        note: 'DLC'
      })
    }
  }

  const fullGameId = Number(details.fullgame?.appid)
  if (Number.isInteger(fullGameId) && fullGameId > 0) {
    facts.push({
      mediaType: 'game',
      source: STEAM_SOURCE_ID,
      externalId: String(fullGameId),
      type: 'parentStory',
      note: 'Full game'
    })
  }

  return facts
}

/**
 * Library capsules live on the assets CDN without an API; both resolutions
 * are stated with the store header as the always-present fallback.
 */
function buildCovers(appId: number, details: SteamAppDetails): string[] {
  return dedupe([
    `${STEAM_ASSETS_URL}/${appId}/library_600x900_2x.jpg`,
    `${STEAM_ASSETS_URL}/${appId}/library_600x900.jpg`,
    details.header_image
  ])
}

function buildBackdrops(appId: number, details: SteamAppDetails): string[] {
  return dedupe([
    `${STEAM_ASSETS_URL}/${appId}/library_hero.jpg`,
    details.background_raw,
    ...(details.screenshots ?? []).slice(0, 10).map((screenshot) => screenshot?.path_full)
  ])
}

/**
 * Release dates are localized display strings. English parses fully; other
 * locales fall back to CJK numeric patterns and finally a bare year.
 */
export function parseReleaseDate(value: string | null | undefined): PartialDate | undefined {
  const raw = value?.trim()
  if (!raw) {
    return undefined
  }

  const cjk = /(\d{4})\s*年\s*(?:(\d{1,2})\s*月\s*(?:(\d{1,2})\s*日)?)?/.exec(raw)
  if (cjk) {
    const result: PartialDate = { year: Number(cjk[1]) }
    if (cjk[2] !== undefined) {
      result.month = Number(cjk[2])
      if (cjk[3] !== undefined) {
        result.day = Number(cjk[3])
      }
    }
    return result
  }

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return {
      year: parsed.getUTCFullYear(),
      month: parsed.getUTCMonth() + 1,
      day: parsed.getUTCDate()
    }
  }

  const year = /(\d{4})/.exec(raw)
  return year ? { year: Number(year[1]) } : undefined
}

/** Store descriptions embed HTML; the library stores plain text. */
function normalizeDescription(value: string | null | undefined): string | undefined {
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
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text || undefined
}

function dedupe(urls: readonly (string | null | undefined)[]): string[] {
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

function memoize<T>(load: () => Promise<T>): () => Promise<T> {
  let value: T | undefined
  let loaded = false

  return async () => {
    if (!loaded) {
      value = await load()
      loaded = true
    }
    return value as T
  }
}
