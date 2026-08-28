import {
  kisaki,
  type ExtensionLogger,
  type ExternalId,
  type TaskRunHandle,
  type TaskRunWarning
} from '@kisaki3/extension-sdk'
import type { MangadexClient } from '../api/client'
import { m } from '../i18n'
import {
  listAllComics,
  readMangadexId,
  updateComicUserState,
  type ComicUserStatePatch,
  type LocalComicEntry
} from '../library'
import { buildMangaExternalIds, buildReleaseDate } from '../media/format/facts'
import { selectMangaTitles } from '../media/format/titles'
import { statusFromMangadex } from '../sync/engine'
import type { SyncSuppressor } from '../sync/suppressor'
import { toSafeErrorLog } from '../utils/errors'
import { omitUndefined } from '../utils/object'

const REPORT_EVERY = 5

export interface ImportOptions {
  updateExisting: boolean
  createMissing: boolean
  profileId?: string
  /** Also read the user's ratings and write them as scores. */
  importScores: boolean
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
  client: MangadexClient
  suppressor: SyncSuppressor
  logger?: ExtensionLogger
}

/**
 * Imports the account's reading statuses (and optionally ratings) into the
 * library.
 *
 * One call returns every status; ratings read in batches. Import never
 * deletes: it writes status and score onto matched entries and, when asked,
 * creates missing ones through a scraper profile — that path fetches the
 * entry detail first, because the statuses endpoint carries ids only.
 */
export async function runStatusImport(
  deps: ImportRunnerDependencies,
  options: ImportOptions,
  handle: TaskRunHandle
): Promise<ImportSummary> {
  await handle.report({
    phase: { key: 'read', label: m().import.phaseRead },
    work: { indeterminate: true }
  })

  const statuses = await deps.client.getAllReadingStatuses({ signal: handle.signal })
  const mangaIds = Object.keys(statuses)
  const ratings = options.importScores
    ? await deps.client.getRatings(mangaIds, { signal: handle.signal })
    : {}

  const localByMangaId = new Map<string, LocalComicEntry>()
  for (const entry of await listAllComics()) {
    const mangaId = readMangadexId(entry.externalIds ?? [])
    if (mangaId !== null && !localByMangaId.has(mangaId)) {
      localByMangaId.set(mangaId, entry)
    }
  }

  const summary: ImportSummary = {
    total: mangaIds.length,
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    failed: 0,
    warnings: []
  }

  for (const [index, mangaId] of mangaIds.entries()) {
    handle.signal.throwIfAborted()

    try {
      await importItem(
        deps,
        options,
        localByMangaId,
        mangaId,
        statuses[mangaId],
        ratings,
        summary,
        handle
      )
    } catch (error) {
      summary.failed += 1
      if (summary.warnings.length < 20) {
        summary.warnings.push({ message: m().import.itemFailed({ id: mangaId }) })
      }
      deps.logger?.warn('MangaDex status import failed for one entry.', {
        mangaId,
        ...toSafeErrorLog(error)
      })
    }

    if ((index + 1) % REPORT_EVERY === 0 || index + 1 === mangaIds.length) {
      await handle.report({
        phase: { key: 'apply', label: m().import.phaseApply },
        work: { current: index + 1, total: mangaIds.length, unit: 'entity' },
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

async function importItem(
  deps: ImportRunnerDependencies,
  options: ImportOptions,
  localByMangaId: ReadonlyMap<string, LocalComicEntry>,
  mangaId: string,
  remoteStatus: string | undefined,
  ratings: Readonly<Record<string, number>>,
  summary: ImportSummary,
  handle: TaskRunHandle
): Promise<void> {
  const status = statusFromMangadex(remoteStatus)
  const score = options.importScores ? normalizeRating(ratings[mangaId]) : undefined
  const existing = localByMangaId.get(mangaId)

  if (existing) {
    if (!options.updateExisting) {
      summary.skipped += 1
      return
    }

    const patch: ComicUserStatePatch = {}
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

    deps.suppressor.suppressImport(existing.id)
    await updateComicUserState(existing.id, patch)
    summary.updated += 1
    return
  }

  if (!options.createMissing || !options.profileId) {
    summary.skipped += 1
    return
  }

  // Statuses carry ids only; the detail read supplies the lookup identity.
  const manga = await deps.client.getManga(mangaId, { signal: handle.signal })
  const titles = selectMangaTitles(manga.attributes, { locale: 'en', preferRomanized: false })
  const knownIds: ExternalId[] = buildMangaExternalIds(manga)
  const lookup = omitUndefined({
    name: titles?.name ?? mangaId,
    knownIds,
    releaseDate: buildReleaseDate(manga.attributes)
  })

  const result = await kisaki.ingest.comic.add.fromScraper(options.profileId, lookup)

  const patch: ComicUserStatePatch = omitUndefined({ status, score })
  if (Object.keys(patch).length > 0) {
    deps.suppressor.suppressImport(result.comicId)
    await updateComicUserState(result.comicId, patch)
  }

  if (result.isNew) {
    summary.created += 1
  } else {
    summary.updated += 1
  }
}

function normalizeRating(rating: number | undefined): number | undefined {
  if (typeof rating !== 'number' || !Number.isFinite(rating) || rating <= 0) {
    return undefined
  }

  return Math.min(10, rating)
}
