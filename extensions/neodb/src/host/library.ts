/**
 * Local-library glue for the NeoDB integration.
 *
 * Sync and import operate on novel entries that carry a NeoDB id; the
 * capability reads, the user-state writes, and the change subscription live
 * here as the single owner of that seam.
 */

import {
  kisaki,
  type Disposable,
  type ExternalId,
  type HooksRegistrar,
  type LibraryMediaStatus
} from '@kisaki3/extension-sdk'
import { parseNeodbId } from './identity/ids'
import { NEODB_SOURCE_ID } from './utils/constants'

const LIST_PAGE_SIZE = 500

export interface LocalNovelEntry {
  id: string
  name: string
  status?: LibraryMediaStatus | undefined
  score?: number | null | undefined
  externalIds: readonly ExternalId[]
}

/** The NeoDB id an entry carries, if any. */
export function readNeodbId(externalIds: readonly ExternalId[]): string | null {
  for (const entry of externalIds) {
    if (entry.source.trim().toLowerCase() !== NEODB_SOURCE_ID) {
      continue
    }

    const id = parseNeodbId(entry.id)
    if (id !== null) {
      return id
    }
  }

  return null
}

export async function listAllNovels(): Promise<LocalNovelEntry[]> {
  const entries: LocalNovelEntry[] = []
  let offset = 0

  for (;;) {
    const page = await kisaki.library.novels.list({ limit: LIST_PAGE_SIZE, offset })
    entries.push(...page)
    if (page.length < LIST_PAGE_SIZE) {
      return entries
    }
    offset += page.length
  }
}

export async function getNovel(id: string): Promise<LocalNovelEntry | null> {
  return kisaki.library.novels.get(id)
}

export interface NovelUserStatePatch {
  status?: LibraryMediaStatus | undefined
  score?: number | null | undefined
}

export async function updateNovelUserState(id: string, patch: NovelUserStatePatch): Promise<void> {
  // Explicitly-undefined members mean "leave unchanged"; an all-absent patch
  // must not become an empty library update.
  if (Object.values(patch).every((value) => value === undefined)) {
    return
  }

  await kisaki.library.novels.update(id, patch)
}

/**
 * Reports novel entries whose synced facets moved. `identity` is included
 * because the first scrape writes the NeoDB id through it — the moment an
 * entry becomes pushable.
 */
export function subscribeNovelChanges(
  hooks: HooksRegistrar,
  selfActor: string,
  listener: (novelId: string) => void
): Disposable {
  return hooks.on('library.changed', ({ changes }) => {
    for (const change of changes) {
      if (change.kind !== 'updated' || change.entity !== 'novel') {
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
