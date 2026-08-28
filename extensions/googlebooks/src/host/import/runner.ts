import {
  kisaki,
  type ExtensionLogger,
  type ExternalId,
  type LibraryMediaStatus,
  type TaskRunHandle,
  type TaskRunWarning
} from '@kisaki3/extension-sdk'
import type { GbooksClient } from '../api/client'
import type { GbVolume } from '../api/types'
import { m } from '../i18n'
import {
  buildVolumeExternalIds,
  isComicVolume,
  parsePublishedDate,
  readSeriesMembership
} from '../media/format'
import {
  GBOOKS_SHELF_HAVE_READ,
  GBOOKS_SHELF_MY_EBOOKS,
  GBOOKS_SHELF_PAGE_SIZE,
  GBOOKS_SHELF_READING_NOW,
  GBOOKS_SHELF_TO_READ,
  GBOOKS_SOURCE_ID,
  ISBN_SOURCE_ID
} from '../utils/constants'
import { toSafeErrorLog } from '../utils/errors'
import { omitUndefined } from '../utils/object'

const REPORT_EVERY = 5
const LIST_PAGE_SIZE = 500

export interface ImportOptions {
  /** Import the purchased and uploaded "My Google eBooks" library. */
  includeEbooks: boolean
  /** Import the predefined reading shelves as entry statuses. */
  includeReadingShelves: boolean
  updateExisting: boolean
  createMissing: boolean
  /** Collapse volumes of one series into a single entry. */
  mergeSeries: boolean
  /** Scraper profiles used to create missing entries, per routed media type. */
  novelProfileId?: string
  comicProfileId?: string
}

export interface ImportSummary {
  total: number
  created: number
  updated: number
  unchanged: number
  skipped: number
  failed: number
  /** Volumes folded away by series merging. */
  mergedAway: number
  warnings: TaskRunWarning[]
}

export interface ImportRunnerDependencies {
  client: GbooksClient
  logger?: ExtensionLogger
}

/** Higher wins when one volume sits on several shelves. */
const STATUS_RANK: Record<string, number> = { completed: 3, active: 2, planned: 1 }

function statusRank(status: LibraryMediaStatus | undefined): number {
  return status ? (STATUS_RANK[status] ?? 0) : 0
}

interface ImportRow {
  volume: GbVolume
  status?: LibraryMediaStatus
}

interface LocalMatch {
  kind: 'novel' | 'comic'
  id: string
  status?: LibraryMediaStatus
}

/**
 * Imports the Google Books library into the catalog.
 *
 * The purchased library carries no reading statement, so it imports without a
 * status; the predefined reading shelves become entry statuses. Volumes route
 * to the comic or novel library by their BISAC categories, series volumes can
 * merge into one entry, and matching honors both the volume id and the ISBN.
 * Google Books carries purchases rather than tracking, so nothing pushes back.
 */
export async function runLibraryImport(
  deps: ImportRunnerDependencies,
  options: ImportOptions,
  handle: TaskRunHandle
): Promise<ImportSummary> {
  await handle.report({
    phase: { key: 'read', label: m().import.phaseRead },
    work: { indeterminate: true }
  })

  const rowByVolumeId = new Map<string, ImportRow>()
  const collect = async (
    shelfId: number,
    status: LibraryMediaStatus | undefined
  ): Promise<void> => {
    for (const volume of await readWholeShelf(deps, shelfId, handle.signal)) {
      const existing = rowByVolumeId.get(volume.id)
      if (!existing) {
        rowByVolumeId.set(volume.id, omitUndefined({ volume, status }))
        continue
      }

      if (status !== undefined && statusRank(status) > statusRank(existing.status)) {
        existing.status = status
      }
    }
  }

  if (options.includeEbooks) {
    await collect(GBOOKS_SHELF_MY_EBOOKS, undefined)
  }
  if (options.includeReadingShelves) {
    await collect(GBOOKS_SHELF_TO_READ, 'planned')
    await collect(GBOOKS_SHELF_READING_NOW, 'active')
    await collect(GBOOKS_SHELF_HAVE_READ, 'completed')
  }

  const { rows, mergedAway } = options.mergeSeries
    ? mergeSeriesRows([...rowByVolumeId.values()])
    : { rows: [...rowByVolumeId.values()], mergedAway: 0 }

  const localIndex = await indexLocalEntries()

  const summary: ImportSummary = {
    total: rows.length,
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    failed: 0,
    mergedAway,
    warnings: []
  }

  for (const [index, row] of rows.entries()) {
    handle.signal.throwIfAborted()

    try {
      await importRow(options, localIndex, row, summary)
    } catch (error) {
      summary.failed += 1
      if (summary.warnings.length < 20) {
        summary.warnings.push({
          message: m().import.itemFailed({
            id: row.volume.volumeInfo?.title?.trim() || row.volume.id
          })
        })
      }
      deps.logger?.warn('Google Books import failed for one volume.', {
        volumeId: row.volume.id,
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
          failed: summary.failed,
          mergedAway: summary.mergedAway
        }
      })
    }
  }

  return summary
}

async function readWholeShelf(
  deps: ImportRunnerDependencies,
  shelfId: number,
  signal: AbortSignal
): Promise<GbVolume[]> {
  const volumes: GbVolume[] = []

  for (let startIndex = 0; ; startIndex += GBOOKS_SHELF_PAGE_SIZE) {
    const page = await deps.client.getShelfVolumesPage(shelfId, startIndex, { signal })
    const items = page.items ?? []
    volumes.push(...items)

    const total = page.totalItems ?? volumes.length
    if (items.length === 0 || volumes.length >= total) {
      return volumes
    }
  }
}

/** Keeps one volume per series (lowest order), counting the folded rest. */
function mergeSeriesRows(rows: ImportRow[]): { rows: ImportRow[]; mergedAway: number } {
  const standalone: ImportRow[] = []
  const bySeries = new Map<string, { row: ImportRow; orderNumber: number; members: number }>()

  for (const row of rows) {
    const membership = readSeriesMembership(row.volume.volumeInfo)
    if (!membership) {
      standalone.push(row)
      continue
    }

    const current = bySeries.get(membership.seriesId)
    if (!current) {
      bySeries.set(membership.seriesId, {
        row,
        orderNumber: membership.orderNumber,
        members: 1
      })
      continue
    }

    current.members += 1
    if (membership.orderNumber < current.orderNumber) {
      current.row = mergeStatus(row, current.row)
      current.orderNumber = membership.orderNumber
    } else {
      current.row = mergeStatus(current.row, row)
    }
  }

  let mergedAway = 0
  const merged: ImportRow[] = [...standalone]
  for (const group of bySeries.values()) {
    merged.push(group.row)
    mergedAway += group.members - 1
  }

  return { rows: merged, mergedAway }
}

/** The kept row inherits the strongest status seen across the series. */
function mergeStatus(kept: ImportRow, other: ImportRow): ImportRow {
  if (other.status !== undefined && statusRank(other.status) > statusRank(kept.status)) {
    return { ...kept, status: other.status }
  }
  return kept
}

async function indexLocalEntries(): Promise<Map<string, LocalMatch>> {
  const index = new Map<string, LocalMatch>()

  const add = (key: string, match: LocalMatch): void => {
    if (!index.has(key)) {
      index.set(key, match)
    }
  }

  for (const kind of ['novel', 'comic'] as const) {
    for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
      const page =
        kind === 'novel'
          ? await kisaki.library.novels.list({ limit: LIST_PAGE_SIZE, offset })
          : await kisaki.library.comics.list({ limit: LIST_PAGE_SIZE, offset })

      for (const entry of page) {
        const match: LocalMatch = omitUndefined({
          kind,
          id: entry.id,
          status: entry.status ?? undefined
        })
        for (const externalId of entry.externalIds ?? []) {
          const source = externalId.source.trim().toLowerCase()
          if (source === GBOOKS_SOURCE_ID) {
            add(`gb:${externalId.id.trim()}`, match)
          }
          if (source === ISBN_SOURCE_ID) {
            add(`isbn:${externalId.id.replace(/-/g, '').trim()}`, match)
          }
        }
      }

      if (page.length < LIST_PAGE_SIZE) {
        break
      }
    }
  }

  return index
}

async function importRow(
  options: ImportOptions,
  localIndex: ReadonlyMap<string, LocalMatch>,
  row: ImportRow,
  summary: ImportSummary
): Promise<void> {
  const externalIds = buildVolumeExternalIds(row.volume)
  const existing = findLocalMatch(localIndex, externalIds)

  if (existing) {
    if (!options.updateExisting || row.status === undefined) {
      summary.skipped += 1
      return
    }

    if (existing.status === row.status) {
      summary.unchanged += 1
      return
    }

    if (existing.kind === 'novel') {
      await kisaki.library.novels.update(existing.id, { status: row.status })
    } else {
      await kisaki.library.comics.update(existing.id, { status: row.status })
    }
    summary.updated += 1
    return
  }

  const kind = isComicVolume(row.volume.volumeInfo) ? 'comic' : 'novel'
  const profileId = kind === 'comic' ? options.comicProfileId : options.novelProfileId
  if (!options.createMissing || !profileId) {
    summary.skipped += 1
    return
  }

  const lookup = omitUndefined({
    name: row.volume.volumeInfo?.title?.trim() || row.volume.id,
    knownIds: externalIds,
    releaseDate: parsePublishedDate(row.volume.volumeInfo?.publishedDate)
  })

  const result =
    kind === 'comic'
      ? await kisaki.ingest.comic.add.fromScraper(profileId, lookup)
      : await kisaki.ingest.novel.add.fromScraper(profileId, lookup)
  const entryId = 'comicId' in result ? result.comicId : result.novelId

  if (row.status !== undefined) {
    if (kind === 'comic') {
      await kisaki.library.comics.update(entryId, { status: row.status })
    } else {
      await kisaki.library.novels.update(entryId, { status: row.status })
    }
  }

  if (result.isNew) {
    summary.created += 1
  } else {
    summary.updated += 1
  }
}

function findLocalMatch(
  localIndex: ReadonlyMap<string, LocalMatch>,
  externalIds: readonly ExternalId[]
): LocalMatch | undefined {
  for (const externalId of externalIds) {
    const key =
      externalId.source === GBOOKS_SOURCE_ID
        ? `gb:${externalId.id}`
        : externalId.source === ISBN_SOURCE_ID
          ? `isbn:${externalId.id}`
          : undefined
    if (!key) {
      continue
    }

    const match = localIndex.get(key)
    if (match) {
      return match
    }
  }

  return undefined
}
