import {
  kisaki,
  type ExtensionLogger,
  type TaskRunHandle,
  type TaskRunWarning
} from '@kisaki3/extension-sdk'
import type { NeodbClient } from '../api/client'
import type { NdMark, NdShelfType } from '../api/types'
import { m } from '../i18n'
import {
  listAllNovels,
  readNeodbId,
  updateNovelUserState,
  type LocalNovelEntry,
  type NovelUserStatePatch
} from '../library'
import { buildBookExternalIds, buildReleaseDate, pickItemTitle } from '../media/format'
import { scoreFromRatingGrade, statusFromShelf } from '../sync/engine'
import { toSafeErrorLog } from '../utils/errors'

const REPORT_EVERY = 5
const SHELF_TYPES: readonly NdShelfType[] = ['wishlist', 'progress', 'complete', 'dropped']

export interface ImportOptions {
  updateExisting: boolean
  createMissing: boolean
  profileId?: string
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
  client: NeodbClient
  logger?: ExtensionLogger
}

interface ShelfRow {
  itemUuid: string
  mark: NdMark
}

/**
 * Imports the account's book shelf into the library.
 *
 * All four shelves are read page by page. Import never deletes: it writes
 * status and rating onto matched entries and, when asked, creates missing
 * ones through a scraper profile — that path fetches the book detail first so
 * the lookup carries the ISBN alongside the NeoDB id. Item failures are
 * counted and reported, never fatal.
 */
export async function runShelfImport(
  deps: ImportRunnerDependencies,
  options: ImportOptions,
  handle: TaskRunHandle
): Promise<ImportSummary> {
  await handle.report({
    phase: { key: 'read', label: m().import.phaseRead },
    work: { indeterminate: true }
  })

  const rows: ShelfRow[] = []
  for (const shelfType of SHELF_TYPES) {
    rows.push(...(await readWholeShelf(deps, shelfType, handle.signal)))
  }

  const localByUuid = new Map<string, LocalNovelEntry>()
  for (const entry of await listAllNovels()) {
    const uuid = readNeodbId(entry.externalIds ?? [])
    if (uuid !== null && !localByUuid.has(uuid)) {
      localByUuid.set(uuid, entry)
    }
  }

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
      await importItem(deps, options, localByUuid, row, summary, handle)
    } catch (error) {
      summary.failed += 1
      if (summary.warnings.length < 20) {
        summary.warnings.push({ message: m().import.itemFailed({ id: row.itemUuid }) })
      }
      deps.logger?.warn('NeoDB shelf import failed for one entry.', {
        itemUuid: row.itemUuid,
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

async function readWholeShelf(
  deps: ImportRunnerDependencies,
  shelfType: NdShelfType,
  signal: AbortSignal
): Promise<ShelfRow[]> {
  const rows: ShelfRow[] = []

  for (let page = 1; ; page += 1) {
    const response = await deps.client.getShelfPage(shelfType, page, { signal })
    for (const mark of response.data ?? []) {
      const itemUuid = mark.item?.uuid
      if (itemUuid) {
        rows.push({ itemUuid, mark: { ...mark, shelf_type: mark.shelf_type ?? shelfType } })
      }
    }

    const pages = response.pages ?? 0
    if (page >= pages || (response.data ?? []).length === 0) {
      return rows
    }
  }
}

async function importItem(
  deps: ImportRunnerDependencies,
  options: ImportOptions,
  localByUuid: ReadonlyMap<string, LocalNovelEntry>,
  row: ShelfRow,
  summary: ImportSummary,
  handle: TaskRunHandle
): Promise<void> {
  const status = statusFromShelf(row.mark.shelf_type)
  const score = scoreFromRatingGrade(row.mark.rating_grade)
  const existing = localByUuid.get(row.itemUuid)

  if (existing) {
    if (!options.updateExisting) {
      summary.skipped += 1
      return
    }

    const patch: NovelUserStatePatch = {}
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

    await updateNovelUserState(existing.id, patch)
    summary.updated += 1
    return
  }

  if (!options.createMissing || !options.profileId) {
    summary.skipped += 1
    return
  }

  // The shelf row carries the item skeleton only; the detail read supplies
  // the ISBN so cross-source resolution starts with an exact id.
  const book = await deps.client.getBook(row.itemUuid, { signal: handle.signal })
  const lookup = {
    name: pickItemTitle(book, 'en') ?? row.itemUuid,
    knownIds: buildBookExternalIds(book),
    releaseDate: buildReleaseDate(book)
  }

  const result = await kisaki.ingest.novel.add.fromScraper(options.profileId, lookup)

  const patch: NovelUserStatePatch = { status, score }
  await updateNovelUserState(result.novelId, patch)

  if (result.isNew) {
    summary.created += 1
  } else {
    summary.updated += 1
  }
}
