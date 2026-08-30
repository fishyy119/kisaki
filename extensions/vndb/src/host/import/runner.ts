import {
  kisaki,
  type ExtensionLogger,
  type TaskRunHandle,
  type TaskRunWarning
} from '@kisaki3/extension-sdk'
import type { VndbClient } from '../api/client'
import type { VndbUserListItem } from '../api/types'
import { m } from '../i18n'
import {
  listAllGames,
  readVndbVnId,
  updateGameUserState,
  type GameUserStatePatch
} from '../library'
import { fromVndbVote, statusFromVndbLabels } from '../sync/engine'
import { parseVndbReleaseDate } from '../media/format/dates'
import { VNDB_SOURCE_ID } from '../utils/constants'
import { VndbExtensionError, toSafeErrorLog } from '../utils/errors'

const ULIST_FIELDS = 'vote, labels{id,label}, vn.title, vn.alttitle, vn.released'
const REPORT_EVERY = 10

export interface ImportOptions {
  /** Write list status and vote onto entries the library already has. */
  updateExisting: boolean
  /** Create entries for list rows the library does not know. */
  createMissing: boolean
  /** Game scraper profile used to create missing entries. */
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
  client: VndbClient
  logger?: ExtensionLogger
}

/**
 * Imports the user's VNDB list into the library.
 *
 * Import never deletes: it writes status and vote onto matched entries and,
 * when asked, creates missing ones through a scraper profile so they arrive
 * with full metadata. Blacklisted rows are the user's explicit rejects and
 * are skipped entirely. Item failures are counted and reported, never fatal.
 */
export async function runUserListImport(
  deps: ImportRunnerDependencies,
  options: ImportOptions,
  handle: TaskRunHandle
): Promise<ImportSummary> {
  const auth = await deps.client.getAuthInfo({ signal: handle.signal })
  if (!(auth.permissions ?? []).includes('listread')) {
    throw new VndbExtensionError('list_permission_missing', m().errors.listPermissionMissing)
  }

  await handle.report({
    phase: { key: 'read', label: m().import.phaseRead },
    work: { indeterminate: true }
  })
  const items = await deps.client.getUserList(auth.id, ULIST_FIELDS, { signal: handle.signal })

  const games = await listAllGames()
  const gamesByVnId = new Map<string, (typeof games)[number]>()
  for (const game of games) {
    const vnId = readVndbVnId(game.externalIds ?? [])
    if (vnId && !gamesByVnId.has(vnId)) {
      gamesByVnId.set(vnId, game)
    }
  }

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
      await importItem(options, gamesByVnId, item, summary)
    } catch (error) {
      summary.failed += 1
      if (summary.warnings.length < 20) {
        summary.warnings.push({ message: m().import.itemFailed({ id: item.id }) })
      }
      deps.logger?.warn('VNDB list item import failed.', {
        vnId: item.id,
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

async function importItem(
  options: ImportOptions,
  gamesByVnId: ReadonlyMap<
    string,
    { id: string; status?: string | undefined; score?: number | null | undefined }
  >,
  item: VndbUserListItem,
  summary: ImportSummary
): Promise<void> {
  const status = statusFromVndbLabels(item.labels)
  if (status === 'blacklisted') {
    summary.skipped += 1
    return
  }

  const score = fromVndbVote(item.vote)
  const existing = gamesByVnId.get(item.id)

  if (existing) {
    if (!options.updateExisting) {
      summary.skipped += 1
      return
    }

    const patch: GameUserStatePatch = {}
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

    await updateGameUserState(existing.id, patch)
    summary.updated += 1
    return
  }

  if (!options.createMissing) {
    summary.skipped += 1
    return
  }
  if (!options.profileId) {
    summary.skipped += 1
    return
  }

  const name = item.vn?.title?.trim() || item.id
  const result = await kisaki.ingest.game.add.fromScraper(options.profileId, {
    name,
    knownIds: [{ source: VNDB_SOURCE_ID, id: item.id }],
    releaseDate: parseVndbReleaseDate(item.vn?.released)
  })

  const patch: GameUserStatePatch = { status, score }
  await updateGameUserState(result.gameId, patch)

  if (result.isNew) {
    summary.created += 1
  } else {
    summary.updated += 1
  }
}
