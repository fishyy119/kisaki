/**
 * Invocation-scoped archive loaders for one game.
 *
 * Slots overlap heavily — characters, persons, and companies all start from
 * the same game archive — so every read is memoized per session and the fan-out
 * reads (character and person archives) happen once for the whole session.
 */

import type { YmgalClient } from '../../api/client'
import { isYmgalNotFound } from '../../api/errors'
import type {
  YmgalCharacter,
  YmgalGameArchiveData,
  YmgalOrganization,
  YmgalOrgGameItem,
  YmgalPerson
} from '../../api/types'
import { collectYmgalArchiveIds, parseYmgalArchiveId } from '../../identity/archive-id'
import type { YmgalRequestContext } from '../runtime'

export interface YmgalOrganizationResources {
  organizationId?: string
  organization?: YmgalOrganization
  relatedGames: YmgalOrgGameItem[]
}

export interface YmgalGameLoaders {
  getArchive(): Promise<YmgalGameArchiveData>
  getCharacters(): Promise<Map<string, YmgalCharacter>>
  getPersons(): Promise<Map<string, YmgalPerson>>
  getOrganization(): Promise<YmgalOrganizationResources>
}

export function createGameLoaders(
  client: YmgalClient,
  gameId: string,
  ctx: YmgalRequestContext
): YmgalGameLoaders {
  const request = { signal: ctx.signal }

  const getArchive = memoize(() => client.getGameArchive(gameId, request))

  const getCharacters = memoize(async () => {
    const archive = await getArchive()
    const ids = collectYmgalArchiveIds(
      (archive.game.characters ?? []).map((relation) => relation.cid)
    )
    return loadArchives(ids, (id) => client.getCharacterArchive(id, request))
  })

  const getPersons = memoize(async () => {
    const archive = await getArchive()
    const ids = collectYmgalArchiveIds([
      ...(archive.game.staff ?? []).map((staff) => staff.pid),
      ...(archive.game.characters ?? []).map((relation) => relation.cvId)
    ])
    return loadArchives(ids, (id) => client.getPersonArchive(id, request))
  })

  const getOrganization = memoize(async (): Promise<YmgalOrganizationResources> => {
    const archive = await getArchive()
    const organizationId = parseYmgalArchiveId(archive.game.developerId)
    if (!organizationId) {
      return { relatedGames: [] }
    }

    // The developer archive and its game list are enrichment on top of the id
    // the game already states, so a missing one still yields the developer.
    const [organization, relatedGames] = await Promise.all([
      skipMissing(() => client.getOrganizationArchive(organizationId, request)),
      skipMissing(() => client.getOrganizationGames(organizationId, request))
    ])

    return {
      organizationId,
      ...(organization ? { organization } : {}),
      relatedGames: relatedGames ?? []
    }
  })

  return { getArchive, getCharacters, getPersons, getOrganization }
}

/** Archives that no longer exist are skipped; anything else fails the slot. */
async function loadArchives<T extends object>(
  ids: readonly string[],
  load: (id: string) => Promise<T>
): Promise<Map<string, T>> {
  const archives = await Promise.all(ids.map((id) => skipMissing(() => load(id))))
  const byId = new Map<string, T>()

  for (const [index, archive] of archives.entries()) {
    if (archive) {
      byId.set(ids[index]!, archive)
    }
  }

  return byId
}

async function skipMissing<T extends object>(load: () => Promise<T>): Promise<T | undefined> {
  try {
    return await load()
  } catch (error) {
    if (isYmgalNotFound(error)) {
      return undefined
    }
    throw error
  }
}

function memoize<T>(load: () => Promise<T>): () => Promise<T> {
  let task: Promise<T> | undefined
  return () => (task ??= load())
}
