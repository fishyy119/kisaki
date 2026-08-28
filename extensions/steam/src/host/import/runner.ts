import {
  kisaki,
  type ExtensionLogger,
  type ExternalId,
  type TaskRunHandle,
  type TaskRunWarning
} from '@kisaki3/extension-sdk'
import type { SteamClient } from '../api/client'
import { m } from '../i18n'
import { parseSteamAppId } from '../identity/ids'
import { STEAM_SOURCE_ID } from '../utils/constants'
import { toSafeErrorLog } from '../utils/errors'

const REPORT_EVERY = 5
const LIST_PAGE_SIZE = 500

export interface ImportOptions {
  /** Scraper profile used to create the missing entries. */
  profileId: string
}

export interface ImportSummary {
  total: number
  created: number
  existing: number
  failed: number
  warnings: TaskRunWarning[]
}

export interface ImportRunnerDependencies {
  client: SteamClient
  logger?: ExtensionLogger
}

/**
 * Imports the owned Steam library into the catalog.
 *
 * Ownership is a fact about having, not about progress, so no status or
 * score is written; entries already carrying the Steam id are left alone and
 * missing ones are created through a scraper profile so they arrive with
 * full metadata. Item failures are counted and reported, never fatal.
 */
export async function runOwnedGamesImport(
  deps: ImportRunnerDependencies,
  options: ImportOptions,
  handle: TaskRunHandle
): Promise<ImportSummary> {
  await handle.report({
    phase: { key: 'read', label: m().import.phaseRead },
    work: { indeterminate: true }
  })

  const owned = await deps.client.getOwnedGames({ signal: handle.signal })
  const knownAppIds = await indexLocalSteamIds()

  const summary: ImportSummary = {
    total: owned.length,
    created: 0,
    existing: 0,
    failed: 0,
    warnings: []
  }

  for (const [index, game] of owned.entries()) {
    handle.signal.throwIfAborted()

    if (knownAppIds.has(game.appid)) {
      summary.existing += 1
    } else {
      try {
        const knownIds: ExternalId[] = [{ source: STEAM_SOURCE_ID, id: String(game.appid) }]
        const result = await kisaki.ingest.game.add.fromScraper(options.profileId, {
          name: game.name?.trim() || String(game.appid),
          knownIds
        })
        if (result.isNew) {
          summary.created += 1
        } else {
          summary.existing += 1
        }
      } catch (error) {
        summary.failed += 1
        if (summary.warnings.length < 20) {
          summary.warnings.push({
            message: m().import.itemFailed({ id: game.name?.trim() || String(game.appid) })
          })
        }
        deps.logger?.warn('Steam owned-game import failed for one entry.', {
          appId: game.appid,
          ...toSafeErrorLog(error)
        })
      }
    }

    if ((index + 1) % REPORT_EVERY === 0 || index + 1 === owned.length) {
      await handle.report({
        phase: { key: 'apply', label: m().import.phaseApply },
        work: { current: index + 1, total: owned.length, unit: 'entity' },
        counters: {
          created: summary.created,
          existing: summary.existing,
          failed: summary.failed
        }
      })
    }
  }

  return summary
}

/** Steam app ids already present in the game library. */
async function indexLocalSteamIds(): Promise<Set<number>> {
  const known = new Set<number>()

  for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
    const page = await kisaki.library.games.list({ limit: LIST_PAGE_SIZE, offset })
    for (const game of page) {
      for (const externalId of game.externalIds ?? []) {
        if (externalId.source.trim().toLowerCase() !== STEAM_SOURCE_ID) {
          continue
        }
        const appId = parseSteamAppId(externalId.id)
        if (appId !== null) {
          known.add(appId)
        }
      }
    }
    if (page.length < LIST_PAGE_SIZE) {
      return known
    }
  }
}
