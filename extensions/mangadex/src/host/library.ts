/**
 * Local-library glue for the MangaDex integration.
 *
 * Sync and import operate on comic entries that carry a MangaDex id; the
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
import { parseMangadexId } from './identity/ids'
import { MANGADEX_SOURCE_ID } from './utils/constants'

const LIST_PAGE_SIZE = 500

export interface LocalComicEntry {
  id: string
  name: string
  status?: LibraryMediaStatus | undefined
  score?: number | null | undefined
  externalIds: readonly ExternalId[]
}

/** The MangaDex id an entry carries, if any. */
export function readMangadexId(externalIds: readonly ExternalId[]): string | null {
  for (const entry of externalIds) {
    if (entry.source.trim().toLowerCase() !== MANGADEX_SOURCE_ID) {
      continue
    }

    const id = parseMangadexId(entry.id)
    if (id !== null) {
      return id
    }
  }

  return null
}

export async function listAllComics(): Promise<LocalComicEntry[]> {
  const entries: LocalComicEntry[] = []
  let offset = 0

  for (;;) {
    const page = await kisaki.library.comics.list({ limit: LIST_PAGE_SIZE, offset })
    entries.push(...page)
    if (page.length < LIST_PAGE_SIZE) {
      return entries
    }
    offset += page.length
  }
}

export async function getComic(id: string): Promise<LocalComicEntry | null> {
  return kisaki.library.comics.get(id)
}

export interface ComicUserStatePatch {
  status?: LibraryMediaStatus | undefined
  score?: number | null | undefined
}

export async function updateComicUserState(id: string, patch: ComicUserStatePatch): Promise<void> {
  // Explicitly-undefined members mean "leave unchanged"; an all-absent patch
  // must not become an empty library update.
  if (Object.values(patch).every((value) => value === undefined)) {
    return
  }

  await kisaki.library.comics.update(id, patch)
}

/**
 * Reports comic entries whose synced facets moved. `identity` is included
 * because the first scrape writes the MangaDex id through it — the moment an
 * entry becomes pushable.
 */
export function subscribeComicChanges(
  hooks: HooksRegistrar,
  selfActor: string,
  listener: (comicId: string) => void
): Disposable {
  return hooks.on('library.changed', ({ changes }) => {
    for (const change of changes) {
      if (change.kind !== 'updated' || change.entity !== 'comic') {
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
