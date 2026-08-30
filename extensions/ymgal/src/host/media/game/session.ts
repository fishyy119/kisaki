import type {
  GameScraperSession,
  GameScraperSlot,
  GameSessionResultMap,
  ScrapedCharacterPersonFact,
  ScrapedGameCharacterFact,
  ScrapedGameCompanyFact,
  ScrapedGameInfo,
  ScrapedGamePersonFact
} from '@kisaki3/extension-sdk'
import type { YmgalClient } from '../../api/client'
import type { YmgalGame } from '../../api/types'
import { parseYmgalArchiveId } from '../../identity/archive-id'
import { YMGAL_COVER_LIMIT } from '../../utils/constants'
import {
  buildCharacterFacts,
  buildCompanyFacts,
  buildIdentity,
  buildPersonFacts,
  toCharacterMetadata,
  toCompanyMetadata,
  toPersonMetadata
} from '../satellites'
import { parseYmgalDate } from '../format/dates'
import { dedupeImageUrls } from '../format/images'
import { resolveDisplayName } from '../format/names'
import { mapCharacterRole, mapStaffRole, readJobName, readStaffNote } from '../format/roles'
import {
  dedupeExternalSites,
  toExternalSites,
  toOptionalSites,
  ymgalGameUrl,
  ymgalSite
} from '../format/sites'
import { normalizeDescription } from '../format/text'
import type { YmgalRequestContext } from '../runtime'
import { createGameLoaders, type YmgalGameLoaders } from './loaders'

export function createYmgalGameSession(
  client: YmgalClient,
  gameId: string,
  ctx: YmgalRequestContext
): GameScraperSession {
  const loaders = createGameLoaders(client, gameId, ctx)
  const tasks = new Map<GameScraperSlot, Promise<unknown>>()

  return {
    get: async (slots) => {
      const output: Partial<GameSessionResultMap> = {}

      await Promise.all(
        slots.map(async (slot) => {
          if (!tasks.has(slot)) {
            tasks.set(slot, loadSlot(slot, loaders, ctx))
          }

          const payload = await tasks.get(slot)!
          if (payload !== undefined) {
            ;(output as Record<GameScraperSlot, unknown>)[slot] = payload
          }
        })
      )

      const archive = await loaders.getArchive()
      return { identity: buildGameIdentity(gameId, archive.game), slots: output }
    }
  }
}

/**
 * Slots YMGal cannot answer are omitted rather than returned empty: the source
 * has no notion of user tags, related entries, or artwork beyond the cover, so
 * an empty answer would let the host clear what another provider supplied.
 */
function loadSlot(
  slot: GameScraperSlot,
  loaders: YmgalGameLoaders,
  ctx: YmgalRequestContext
): Promise<unknown> {
  switch (slot) {
    case 'info':
      return buildGameInfo(loaders, ctx)
    case 'characters':
      return buildCharacters(loaders, ctx)
    case 'persons':
      return buildPersons(loaders, ctx)
    case 'companies':
      return buildCompanies(loaders, ctx)
    case 'covers':
      return buildCovers(loaders)
    case 'tags':
    case 'relatedEntries':
    case 'backdrops':
    case 'logos':
    case 'icons':
      return Promise.resolve(undefined)
  }
}

export function buildGameSites(gameId: string, game: YmgalGame) {
  return dedupeExternalSites([ymgalSite(ymgalGameUrl(gameId)), ...toExternalSites(game.website)])
}

export function buildGameIdentity(gameId: string, game: YmgalGame) {
  return buildIdentity(gameId, buildGameSites(gameId, game))
}

async function buildGameInfo(
  loaders: YmgalGameLoaders,
  ctx: YmgalRequestContext
): Promise<ScrapedGameInfo> {
  const { game } = await loaders.getArchive()
  const gameId = parseYmgalArchiveId(game.gid)
  const { name, originalName } = resolveDisplayName(
    game.name,
    game.chineseName,
    ctx,
    gameId ?? game.name
  )

  return {
    name,
    originalName,
    releaseDate: parseYmgalDate(game.releaseDate),
    description: normalizeDescription(game.introduction),
    externalSites: gameId ? toOptionalSites(buildGameSites(gameId, game)) : undefined
  }
}

async function buildCharacters(
  loaders: YmgalGameLoaders,
  ctx: YmgalRequestContext
): Promise<ScrapedGameCharacterFact[]> {
  const [{ game, cidMapping, pidMapping }, characters, persons] = await Promise.all([
    loaders.getArchive(),
    loaders.getCharacters(),
    loaders.getPersons()
  ])

  const facts: ScrapedGameCharacterFact[] = []

  for (const relation of game.characters ?? []) {
    const characterId = parseYmgalArchiveId(relation.cid)
    if (!characterId) {
      continue
    }

    const actorId = parseYmgalArchiveId(relation.cvId)
    const cast: ScrapedCharacterPersonFact[] = actorId
      ? [
          {
            ...toPersonMetadata(
              buildPersonFacts(actorId, persons.get(actorId), pidMapping?.[actorId], ctx)
            ),
            role: 'actor'
          }
        ]
      : []

    facts.push({
      ...toCharacterMetadata(
        buildCharacterFacts(
          characterId,
          characters.get(characterId),
          cidMapping?.[characterId],
          ctx
        )
      ),
      role: mapCharacterRole(relation.characterPosition),
      persons: cast.length > 0 ? cast : undefined
    })
  }

  return facts
}

async function buildPersons(
  loaders: YmgalGameLoaders,
  ctx: YmgalRequestContext
): Promise<ScrapedGamePersonFact[]> {
  const [{ game, pidMapping }, persons] = await Promise.all([
    loaders.getArchive(),
    loaders.getPersons()
  ])

  const facts: ScrapedGamePersonFact[] = []

  for (const staff of game.staff ?? []) {
    const personId = parseYmgalArchiveId(staff.pid)
    if (!personId) {
      continue
    }

    facts.push({
      ...toPersonMetadata(
        buildPersonFacts(personId, persons.get(personId), pidMapping?.[personId], ctx)
      ),
      role: mapStaffRole(staff),
      // The job name is what the source actually stated; the role is our
      // coarse mapping of it, so an unmapped job still reaches the library.
      note: readStaffNote(staff) ?? readJobName(staff)
    })
  }

  // Voice credits live on the character relation, not in the staff list, so
  // the entry's cast comes from there.
  for (const relation of game.characters ?? []) {
    const actorId = parseYmgalArchiveId(relation.cvId)
    if (!actorId) {
      continue
    }

    facts.push({
      ...toPersonMetadata(
        buildPersonFacts(actorId, persons.get(actorId), pidMapping?.[actorId], ctx)
      ),
      role: 'actor'
    })
  }

  return facts
}

async function buildCompanies(
  loaders: YmgalGameLoaders,
  ctx: YmgalRequestContext
): Promise<ScrapedGameCompanyFact[]> {
  const { organizationId, organization } = await loaders.getOrganization()
  if (!organizationId) {
    // The archive states no developer, so the source has nothing to say about
    // companies at all — not that this game has none.
    return []
  }

  return [
    {
      ...toCompanyMetadata(buildCompanyFacts(organizationId, organization, ctx)),
      role: 'developer'
    }
  ]
}

async function buildCovers(loaders: YmgalGameLoaders): Promise<string[]> {
  const { game } = await loaders.getArchive()
  return dedupeImageUrls([game.mainImg]).slice(0, YMGAL_COVER_LIMIT)
}
