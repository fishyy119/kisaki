/**
 * Local-library glue for the AniList integration.
 *
 * Sync and import operate on anime, comic, and novel entries that carry an
 * AniList id; the per-kind capability reads, the user-state writes, and the
 * change subscription live here as the single owner of that seam.
 */

import {
  kisaki,
  type Disposable,
  type ExternalId,
  type HooksRegistrar,
  type LibraryMediaStatus
} from '@kisaki3/extension-sdk'
import { parseAnilistId } from './identity/ids'
import type { AnilistMediaKind } from './media/kinds'
import { ANILIST_SOURCE_ID } from './utils/constants'

const LIST_PAGE_SIZE = 500

/** Library row shape every synced media kind shares. */
export interface LocalMediaEntry {
  id: string
  name: string
  status?: LibraryMediaStatus
  score?: number | null
  externalIds: readonly ExternalId[]
}

export interface LocalMediaRef {
  kind: AnilistMediaKind
  id: string
}

/** The AniList media id an entry carries, if any. */
export function readAnilistMediaId(externalIds: readonly ExternalId[]): number | null {
  for (const entry of externalIds) {
    if (entry.source.trim().toLowerCase() !== ANILIST_SOURCE_ID) {
      continue
    }

    const id = parseAnilistId(entry.id)
    if (id !== null) {
      return id
    }
  }

  return null
}

export async function listAllEntries(kind: AnilistMediaKind): Promise<LocalMediaEntry[]> {
  const entries: LocalMediaEntry[] = []
  let offset = 0

  for (;;) {
    const page = await listPage(kind, offset)
    entries.push(...page)
    if (page.length < LIST_PAGE_SIZE) {
      return entries
    }
    offset += page.length
  }
}

export async function getEntry(ref: LocalMediaRef): Promise<LocalMediaEntry | null> {
  switch (ref.kind) {
    case 'anime':
      return kisaki.library.animes.get(ref.id)
    case 'comic':
      return kisaki.library.comics.get(ref.id)
    case 'novel':
      return kisaki.library.novels.get(ref.id)
  }
}

export interface MediaUserStatePatch {
  status?: LibraryMediaStatus
  score?: number | null
}

export async function updateEntryUserState(
  ref: LocalMediaRef,
  patch: MediaUserStatePatch
): Promise<void> {
  if (Object.keys(patch).length === 0) {
    return
  }

  switch (ref.kind) {
    case 'anime':
      await kisaki.library.animes.update(ref.id, patch)
      return
    case 'comic':
      await kisaki.library.comics.update(ref.id, patch)
      return
    case 'novel':
      await kisaki.library.novels.update(ref.id, patch)
      return
  }
}

/**
 * Reports entries whose synced facets moved, across the three media kinds.
 *
 * `identity` is included because the first scrape writes the AniList id
 * through it — the moment an entry becomes pushable. Creations are skipped:
 * a just-created entry has no AniList id until a scrape assigns one.
 */
export function subscribeEntryChanges(
  hooks: HooksRegistrar,
  listener: (ref: LocalMediaRef) => void
): Disposable {
  return hooks.on('library.changed', ({ changes }) => {
    for (const change of changes) {
      if (change.kind !== 'updated') {
        continue
      }
      if (change.entity !== 'anime' && change.entity !== 'comic' && change.entity !== 'novel') {
        continue
      }

      const facets = new Set((change.changes ?? []).map((entry) => entry.facet))
      if (facets.has('status') || facets.has('score') || facets.has('identity')) {
        listener({ kind: change.entity, id: change.id })
      }
    }
  })
}

async function listPage(kind: AnilistMediaKind, offset: number): Promise<LocalMediaEntry[]> {
  const query = { limit: LIST_PAGE_SIZE, offset }
  switch (kind) {
    case 'anime':
      return [...(await kisaki.library.animes.list(query))]
    case 'comic':
      return [...(await kisaki.library.comics.list(query))]
    case 'novel':
      return [...(await kisaki.library.novels.list(query))]
  }
}
