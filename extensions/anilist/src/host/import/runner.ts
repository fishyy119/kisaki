import {
  kisaki,
  type ExtensionLogger,
  type ExternalId,
  type PartialDate,
  type TaskRunHandle,
  type TaskRunWarning
} from '@kisaki3/extension-sdk'
import type { AnilistClient } from '../api/client'
import type { AnilistMediaListEntry } from '../api/types'
import { m } from '../i18n'
import {
  listAllEntries,
  readAnilistMediaId,
  updateEntryUserState,
  type LocalMediaEntry,
  type LocalMediaRef,
  type MediaUserStatePatch
} from '../library'
import { parseFuzzyDate } from '../media/format/dates'
import { selectMediaTitles } from '../media/format/names'
import { buildMediaExternalIds } from '../media/format/sites'
import { resolveMediaKind, type AnilistMediaKind } from '../media/kinds'
import { fromScore100, statusFromAnilist } from '../sync/engine'
import { toSafeErrorLog } from '../utils/errors'

const REPORT_EVERY = 10

export interface ImportOptions {
  /** Which AniList lists to read. */
  lists: ('anime' | 'manga')[]
  updateExisting: boolean
  createMissing: boolean
  /** Scraper profiles used to create missing entries, per local media kind. */
  profileIds: Partial<Record<AnilistMediaKind, string>>
}

export interface ImportSummary {
  total: number
  created: number
  updated: number
  unchanged: number
  skipped: number
  failed: number
  warnings: TaskRunWarning[]
}

export interface ImportRunnerDependencies {
  client: AnilistClient
  logger?: ExtensionLogger
}

/**
 * Imports the signed-in user's AniList lists into the library.
 *
 * The manga list carries comics and light novels side by side; each row is
 * routed to its local media kind before matching. Import never deletes: it
 * writes status and score onto matched entries and, when asked, creates
 * missing ones through a scraper profile so they arrive with full metadata.
 * Item failures are counted and reported, never fatal.
 */
export async function runListImport(
  deps: ImportRunnerDependencies,
  options: ImportOptions,
  handle: TaskRunHandle
): Promise<ImportSummary> {
  await handle.report({
    phase: { key: 'read', label: m().import.phaseRead },
    work: { indeterminate: true }
  })

  const viewer = await deps.client.getViewer({ signal: handle.signal })
  const rows: AnilistMediaListEntry[] = []
  if (options.lists.includes('anime')) {
    rows.push(...(await readList(deps, viewer.id, 'ANIME', handle.signal)))
  }
  if (options.lists.includes('manga')) {
    rows.push(...(await readList(deps, viewer.id, 'MANGA', handle.signal)))
  }

  // Custom lists repeat entries the status lists already carry.
  const items = dedupeByMediaId(rows)

  const localByMediaId = await indexLocalEntries()

  const summary: ImportSummary = {
    total: items.length,
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    failed: 0,
    warnings: []
  }

  for (const [index, item] of items.entries()) {
    handle.signal.throwIfAborted()

    try {
      await importItem(options, localByMediaId, item, summary)
    } catch (error) {
      summary.failed += 1
      if (summary.warnings.length < 20) {
        summary.warnings.push({
          message: m().import.itemFailed({ id: String(item.media?.id ?? '?') })
        })
      }
      deps.logger?.warn('AniList list item import failed.', {
        mediaId: item.media?.id,
        ...toSafeErrorLog(error)
      })
    }

    if ((index + 1) % REPORT_EVERY === 0 || index + 1 === items.length) {
      await handle.report({
        phase: { key: 'apply', label: m().import.phaseApply },
        work: { current: index + 1, total: items.length, unit: 'entity' },
        counters: {
          created: summary.created,
          updated: summary.updated,
          unchanged: summary.unchanged,
          skipped: summary.skipped,
          failed: summary.failed
        }
      })
    }
  }

  return summary
}

async function readList(
  deps: ImportRunnerDependencies,
  userId: number,
  type: 'ANIME' | 'MANGA',
  signal: AbortSignal
): Promise<AnilistMediaListEntry[]> {
  const collection = await deps.client.getMediaListCollection(userId, type, { signal })
  return (collection.lists ?? []).flatMap((group) => group.entries ?? [])
}

function dedupeByMediaId(rows: readonly AnilistMediaListEntry[]): AnilistMediaListEntry[] {
  const seen = new Set<number>()
  const items: AnilistMediaListEntry[] = []

  for (const row of rows) {
    const id = row.media?.id
    if (typeof id !== 'number' || seen.has(id)) {
      continue
    }
    seen.add(id)
    items.push(row)
  }

  return items
}

async function indexLocalEntries(): Promise<Map<number, LocalMediaRef & LocalMediaEntry>> {
  const index = new Map<number, LocalMediaRef & LocalMediaEntry>()

  for (const kind of ['anime', 'comic', 'novel'] as const) {
    for (const entry of await listAllEntries(kind)) {
      const mediaId = readAnilistMediaId(entry.externalIds ?? [])
      if (mediaId !== null && !index.has(mediaId)) {
        index.set(mediaId, { ...entry, kind })
      }
    }
  }

  return index
}

async function importItem(
  options: ImportOptions,
  localByMediaId: ReadonlyMap<number, LocalMediaRef & LocalMediaEntry>,
  item: AnilistMediaListEntry,
  summary: ImportSummary
): Promise<void> {
  const media = item.media
  if (!media) {
    summary.skipped += 1
    return
  }

  const kind = resolveMediaKind(media.type, media.format)
  if (!kind) {
    summary.skipped += 1
    return
  }

  const status = statusFromAnilist(item.status)
  const score = fromScore100(item.score)
  const existing = localByMediaId.get(media.id)

  if (existing) {
    if (!options.updateExisting) {
      summary.skipped += 1
      return
    }

    const patch: MediaUserStatePatch = {}
    if (status !== undefined && status !== existing.status) {
      patch.status = status
    }
    if (score !== undefined && score !== existing.score) {
      patch.score = score
    }

    if (Object.keys(patch).length === 0) {
      summary.unchanged += 1
      return
    }

    await updateEntryUserState({ kind: existing.kind, id: existing.id }, patch)
    summary.updated += 1
    return
  }

  const profileId = options.profileIds[kind]
  if (!options.createMissing || !profileId) {
    summary.skipped += 1
    return
  }

  const titles = selectMediaTitles(media.title, undefined, { locale: 'en', preferRomaji: false })
  const lookup = {
    name: titles?.name ?? String(media.id),
    knownIds: buildMediaExternalIds(media.id, media.idMal),
    releaseDate: parseFuzzyDate(media.startDate)
  }

  const result = await addFromScraper(kind, profileId, lookup)

  const patch: MediaUserStatePatch = { status, score }
  await updateEntryUserState({ kind, id: result.id }, patch)

  if (result.isNew) {
    summary.created += 1
  } else {
    summary.updated += 1
  }
}

/** Shared subset of the per-kind scraper lookups; no format is stated. */
interface CommonScraperLookup {
  name: string
  knownIds?: ExternalId[] | undefined
  releaseDate?: PartialDate | undefined
}

async function addFromScraper(
  kind: AnilistMediaKind,
  profileId: string,
  lookup: CommonScraperLookup
): Promise<{ id: string; isNew: boolean }> {
  switch (kind) {
    case 'anime': {
      const result = await kisaki.ingest.anime.add.fromScraper(profileId, lookup)
      return { id: result.animeId, isNew: result.isNew }
    }
    case 'comic': {
      const result = await kisaki.ingest.comic.add.fromScraper(profileId, lookup)
      return { id: result.comicId, isNew: result.isNew }
    }
    case 'novel': {
      const result = await kisaki.ingest.novel.add.fromScraper(profileId, lookup)
      return { id: result.novelId, isNew: result.isNew }
    }
  }
}
