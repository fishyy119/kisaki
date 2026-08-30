import type {
  CharacterScraperProvider,
  CharacterScraperSession,
  CharacterScraperSlot,
  CharacterSearchResult,
  CharacterSessionResultMap,
  IdResolvedTarget,
  ScrapedCharacterPersonFact,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import type { BangumiCharacterPerson } from '../../api/types'
import { BANGUMI_SOURCE_ID } from '../../utils/constants'
import { BANGUMI_LABEL, buildCharacterFacts, type BangumiSatelliteFacts } from '../satellites'
import {
  BangumiSatelliteProvider,
  SATELLITE_SEARCH_RESULT_LIMIT,
  type SatelliteSearchResult
} from '../satellite-provider'
import { extractImageUrls } from '../format/images'
import { buildBangumiPersonUrl, dedupeUrls } from '../format/urls'
import { fetchCharacterDetails, fetchCharacterPersons } from '../subject/characters'

/**
 * Scrapes a character from their own Bangumi entry.
 *
 * The `persons` slot carries the work-independent side of the cast: Bangumi
 * lists every subject a character has been voiced in, and the same actor
 * usually recurs, so the credits are deduplicated into one fact per person.
 */
export class BangumiCharacterProvider
  extends BangumiSatelliteProvider<CharacterSearchResult & SatelliteSearchResult>
  implements CharacterScraperProvider
{
  public readonly capabilities = ['search', 'info', 'tags', 'persons', 'photos'] as const

  async search(
    query: string,
    ctx: ScraperProviderContext
  ): Promise<(CharacterSearchResult & SatelliteSearchResult)[]> {
    const keyword = query.trim()
    if (!keyword) {
      return []
    }

    const page = await this.client.searchCharacters(
      keyword,
      { limit: SATELLITE_SEARCH_RESULT_LIMIT, offset: 0 },
      { signal: ctx.signal }
    )

    return page.items.map((character) => ({
      id: String(character.id),
      name: character.name,
      externalIds: [{ source: this.externalIdSource, id: String(character.id) }]
    }))
  }

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<CharacterScraperSession> {
    const characterId = this.requireSatelliteId(target.id)
    const client = this.client

    let factsTask: Promise<BangumiSatelliteFacts<CharacterSessionResultMap['info']>> | undefined
    let personsTask: Promise<ScrapedCharacterPersonFact[]> | undefined

    const loadFacts = (): Promise<BangumiSatelliteFacts<CharacterSessionResultMap['info']>> =>
      (factsTask ??= (async () => {
        const details = await fetchCharacterDetails(client, [characterId], ctx.signal)
        return buildCharacterFacts(characterId, details.get(characterId), undefined, ctx.locale)
      })())

    const loadPersons = (): Promise<ScrapedCharacterPersonFact[]> =>
      (personsTask ??= (async () => {
        const byCharacter = await fetchCharacterPersons(client, [characterId], ctx.signal)
        return buildCharacterPersons(byCharacter.get(characterId) ?? [])
      })())

    return {
      get: async (slots) => {
        const output: Partial<CharacterSessionResultMap> = {}

        await Promise.all(
          slots.map(async (slot) => {
            const payload = await readSlot(slot, loadFacts, loadPersons)
            if (payload !== undefined) {
              ;(output as Record<CharacterScraperSlot, unknown>)[slot] = payload
            }
          })
        )

        return { identity: (await loadFacts()).identity, slots: output }
      }
    }
  }
}

async function readSlot(
  slot: CharacterScraperSlot,
  loadFacts: () => Promise<BangumiSatelliteFacts<CharacterSessionResultMap['info']>>,
  loadPersons: () => Promise<ScrapedCharacterPersonFact[]>
): Promise<unknown> {
  switch (slot) {
    case 'info':
      return (await loadFacts()).info
    case 'tags':
      return (await loadFacts()).tags
    case 'photos':
      return (await loadFacts()).images
    case 'persons':
      return loadPersons()
  }
}

/**
 * One fact per actor, keeping the first credit's details. A recurring role is
 * the same knowledge stated repeatedly, not several facts.
 */
function buildCharacterPersons(
  credits: readonly BangumiCharacterPerson[]
): ScrapedCharacterPersonFact[] {
  const byPerson = new Map<number, ScrapedCharacterPersonFact>()

  for (const credit of credits) {
    if (byPerson.has(credit.id)) {
      continue
    }

    byPerson.set(credit.id, {
      name: credit.name,
      originalName: credit.name,
      externalSites: [{ label: BANGUMI_LABEL, url: buildBangumiPersonUrl(credit.id) }],
      identity: { externalIds: [{ source: BANGUMI_SOURCE_ID, id: String(credit.id) }] },
      photos: dedupeUrls(extractImageUrls(credit.images)),
      role: 'actor' as const,
      note: credit.staff?.trim() || undefined
    })
  }

  return [...byPerson.values()]
}
