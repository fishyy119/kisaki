import {
  kisaki,
  type ExtensionLogger,
  type ExternalId,
  type PartialDate,
  type TaskRunHandle,
  type TaskRunWarning
} from '@kisaki3/extension-sdk'
import type { MalOfficialClient } from '../api/official-client'
import type { MalEntryNode, MalListStatus } from '../api/types'
import { m } from '../i18n'
import {
  listAllEntries,
  readMalMediaId,
  updateEntryUserState,
  type LocalMediaEntry,
  type LocalMediaRef,
  type MediaUserStatePatch
} from '../library'
import { parseMalDate } from '../media/format/dates'
import { selectMalTitles } from '../media/format/names'
import { toMalExternalId } from '../media/format/sites'
import { resolveMangaKind, type MalMediaKind } from '../media/kinds'
import { scoreFromMal, statusFromMal } from '../sync/engine'
import { MAL_LIST_PAGE_SIZE } from '../utils/constants'
import { toSafeErrorLog } from '../utils/errors'

const REPORT_EVERY = 10

export interface ImportOptions {
  /** Which MAL lists to read. */
  lists: ('anime' | 'manga')[]
  updateExisting: boolean
  createMissing: boolean
  /** Scraper profiles used to create missing entries, per local media kind. */
  profileIds: Partial<Record<MalMediaKind, string>>
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
  client: MalOfficialClient
  logger?: ExtensionLogger
}

interface ListRow {
  kind: MalMediaKind
  node: MalEntryNode
  listStatus: MalListStatus | undefined
}

/**
 * Imports the signed-in user's MAL lists into the library.
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

  const rows: ListRow[] = []
  if (options.lists.includes('anime')) {
    rows.push(...(await readWholeList(deps, 'animelist', handle.signal)))
  }
  if (options.lists.includes('manga')) {
    rows.push(...(await readWholeList(deps, 'mangalist', handle.signal)))
  }

  const localByMediaId = await indexLocalEntries()

  const summary: ImportSummary = {
    total: rows.length,
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    failed: 0,
    warnings: []
  }

  for (const [index, row] of rows.entries()) {
    handle.signal.throwIfAborted()

    try {
      await importItem(options, localByMediaId, row, summary)
    } catch (error) {
      summary.failed += 1
      if (summary.warnings.length < 20) {
        summary.warnings.push({ message: m().import.itemFailed({ id: String(row.node.id) }) })
      }
      deps.logger?.warn('MAL list item import failed.', {
        mediaId: row.node.id,
        ...toSafeErrorLog(error)
      })
    }

    if ((index + 1) % REPORT_EVERY === 0 || index + 1 === rows.length) {
      await handle.report({
        phase: { key: 'apply', label: m().import.phaseApply },
        work: { current: index + 1, total: rows.length, unit: 'entity' },
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

async function readWholeList(
  deps: ImportRunnerDependencies,
  kind: 'animelist' | 'mangalist',
  signal: AbortSignal
): Promise<ListRow[]> {
  const rows: ListRow[] = []

  for (let offset = 0; ; offset += MAL_LIST_PAGE_SIZE) {
    const page = await deps.client.getOwnListPage(kind, offset, MAL_LIST_PAGE_SIZE, { signal })
    const entries = page.data ?? []

    for (const entry of entries) {
      rows.push({
        kind: kind === 'animelist' ? 'anime' : resolveMangaKind(entry.node.media_type),
        node: entry.node,
        listStatus: entry.list_status ?? undefined
      })
    }

    if (entries.length < MAL_LIST_PAGE_SIZE || !page.paging?.next) {
      return rows
    }
  }
}

async function indexLocalEntries(): Promise<Map<number, LocalMediaRef & LocalMediaEntry>> {
  const index = new Map<number, LocalMediaRef & LocalMediaEntry>()

  for (const kind of ['anime', 'comic', 'novel'] as const) {
    for (const entry of await listAllEntries(kind)) {
      const mediaId = readMalMediaId(entry.externalIds ?? [])
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
  row: ListRow,
  summary: ImportSummary
): Promise<void> {
  const status = statusFromMal(row.listStatus?.status)
  const score = scoreFromMal(row.listStatus?.score)
  const existing = localByMediaId.get(row.node.id)

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

  const profileId = options.profileIds[row.kind]
  if (!options.createMissing || !profileId) {
    summary.skipped += 1
    return
  }

  const titles = selectMalTitles(row.node.title, row.node.alternative_titles, {
    locale: 'en',
    preferRomaji: false
  })
  const knownIds: ExternalId[] = [toMalExternalId(row.node.id)]
  const lookup = {
    name: titles?.name ?? String(row.node.id),
    knownIds,
    releaseDate: parseMalDate(row.node.start_date)
  }

  const result = await addFromScraper(row.kind, profileId, lookup)

  const patch: MediaUserStatePatch = { status, score }
  await updateEntryUserState({ kind: row.kind, id: result.id }, patch)

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
  kind: MalMediaKind,
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
