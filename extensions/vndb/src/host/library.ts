/**
 * Local-library glue for the VNDB integration.
 *
 * Sync and import both operate on library game entries that carry a VNDB id,
 * so the capability reads, the user-state writes, and the change subscription
 * live here as the single owner of that seam.
 */

import {
  kisaki,
  type Disposable,
  type ExternalId,
  type HooksRegistrar,
  type LibraryGame,
  type LibraryMediaStatus
} from '@kisaki3/extension-sdk'
import { parseVndbEntryId } from './identity/entry-id'
import { VNDB_SOURCE_ID } from './utils/constants'

const LIST_PAGE_SIZE = 500

/** The VNDB vn id (`v...`) an entry carries, if any. */
export function readVndbVnId(externalIds: readonly ExternalId[]): string | null {
  for (const entry of externalIds) {
    if (entry.source.trim().toLowerCase() !== VNDB_SOURCE_ID) {
      continue
    }

    const id = parseVndbEntryId(entry.id, 'v')
    if (id) {
      return id
    }
  }

  return null
}

export async function listAllGames(): Promise<LibraryGame[]> {
  const games: LibraryGame[] = []
  let offset = 0

  for (;;) {
    const page = await kisaki.library.games.list({ limit: LIST_PAGE_SIZE, offset })
    games.push(...page)
    if (page.length < LIST_PAGE_SIZE) {
      return games
    }
    offset += page.length
  }
}

export async function getGame(gameId: string): Promise<LibraryGame | null> {
  return kisaki.library.games.get(gameId)
}

export interface GameUserStatePatch {
  status?: LibraryMediaStatus | undefined
  score?: number | null | undefined
}

export async function updateGameUserState(
  gameId: string,
  patch: GameUserStatePatch
): Promise<void> {
  // Explicitly-undefined members mean "leave unchanged"; an all-absent patch
  // must not become an empty library update.
  if (Object.values(patch).every((value) => value === undefined)) {
    return
  }

  await kisaki.library.games.update(gameId, patch)
}

/**
 * Reports game entries whose synced facets moved.
 *
 * `identity` is included because the first scrape writes the VNDB id through
 * it — that is the moment an entry becomes pushable at all. Creations are
 * skipped: a just-created entry has no VNDB id until a scrape assigns one.
 */
export function subscribeGameChanges(
  hooks: HooksRegistrar,
  selfActor: string,
  listener: (gameId: string) => void
): Disposable {
  return hooks.on('library.changed', ({ changes }) => {
    for (const change of changes) {
      if (change.entity !== 'game' || change.kind !== 'updated') {
        continue
      }

      // Writes this extension caused come back attributed; reacting to them
      // would only echo our own import or push.
      if (change.actors.every((actor) => actor === selfActor)) {
        continue
      }

      const facets = new Set((change.changes ?? []).map((entry) => entry.facet))
      if (facets.has('status') || facets.has('score') || facets.has('identity')) {
        listener(change.id)
      }
    }
  })
}
