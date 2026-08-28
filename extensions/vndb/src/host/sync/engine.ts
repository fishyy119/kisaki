import type { ExtensionLogger, LibraryMediaStatus } from '@kisaki3/extension-sdk'
import type { VndbClient } from '../api/client'
import type { VndbUserListPatch } from '../api/types'
import type { VndbSettingsStore } from '../config/schema'
import { getGame, readVndbVnId } from '../library'
import { createSyncFingerprint, type SyncStateStore } from './state'
import type { SyncSuppressor } from './suppressor'

/**
 * VNDB's built-in list labels. The five status labels are mutually exclusive
 * in spirit, so a push sets the mapped one and unsets the other four;
 * `Blacklist` (6) and `Voted` (7) are never touched.
 */
export const VNDB_STATUS_LABEL_BY_STATUS: Record<LibraryMediaStatus, number> = {
  active: 1,
  completed: 2,
  onHold: 3,
  dropped: 4,
  planned: 5
}

const VNDB_STATUS_LABEL_IDS = [1, 2, 3, 4, 5]

export type SyncItemStatus =
  | 'synced'
  | 'skippedDisabled'
  | 'skippedMissingItem'
  | 'skippedNoVndbId'
  | 'skippedNoStatus'
  | 'skippedNoChange'
  | 'skippedSuppressed'

export interface SyncItemResult {
  status: SyncItemStatus
  gameId: string
  vnId?: string
}

export interface SyncEngineDependencies {
  settingsStore: VndbSettingsStore
  client: VndbClient
  stateStore: SyncStateStore
  suppressor: SyncSuppressor
  logger?: ExtensionLogger
}

/**
 * Pushes one game entry's status and score to the user's VNDB list.
 *
 * `PATCH /ulist` upserts, so no remote existence check is needed. An empty
 * local score never clears the remote vote: clearing needs stronger authority
 * than writing, and an unset score usually means "not rated here yet".
 */
export class SyncEngine {
  constructor(private readonly deps: SyncEngineDependencies) {}

  async syncItem(
    gameId: string,
    options: { signal?: AbortSignal; force?: boolean } = {}
  ): Promise<SyncItemResult> {
    const settings = await this.deps.settingsStore.get()
    // A manual full push is explicit user intent, so it bypasses the auto gate.
    if (!settings.sync.enabled && !options.force) {
      return { status: 'skippedDisabled', gameId }
    }

    const game = await getGame(gameId)
    if (!game) {
      return { status: 'skippedMissingItem', gameId }
    }

    const vnId = readVndbVnId(game.externalIds ?? [])
    if (!vnId) {
      return { status: 'skippedNoVndbId', gameId }
    }

    const status = game.status
    if (!status) {
      return { status: 'skippedNoStatus', gameId, vnId }
    }

    const labelId = VNDB_STATUS_LABEL_BY_STATUS[status]
    const vote = settings.sync.pushScore ? toVndbVote(game.score) : undefined
    const fingerprint = createSyncFingerprint({
      gameId,
      vnId,
      labelId,
      vote,
      pushScore: settings.sync.pushScore
    })

    if (this.deps.suppressor.match(gameId, fingerprint)) {
      return { status: 'skippedSuppressed', gameId, vnId }
    }

    if ((await this.deps.stateStore.getLastFingerprint(gameId)) === fingerprint) {
      return { status: 'skippedNoChange', gameId, vnId }
    }

    const patch: VndbUserListPatch = {
      labels_set: [labelId],
      labels_unset: VNDB_STATUS_LABEL_IDS.filter((id) => id !== labelId),
      ...(vote !== undefined ? { vote } : {})
    }

    await this.deps.client.patchUserListEntry(vnId, patch, { signal: options.signal })
    await this.deps.stateStore.recordSuccessfulSync({
      gameId,
      vnId,
      fingerprint,
      updatedAt: Date.now()
    })
    this.deps.suppressor.suppressFingerprint(gameId, fingerprint)

    return { status: 'synced', gameId, vnId }
  }
}

/** Local scores are 0-10; VNDB votes are integers 10-100. */
export function toVndbVote(score: number | null | undefined): number | undefined {
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 1) {
    return undefined
  }

  return Math.max(10, Math.min(100, Math.round(score * 10)))
}

/** VNDB votes are integers 10-100; local scores are 0-10 with one decimal. */
export function fromVndbVote(vote: number | null | undefined): number | undefined {
  if (typeof vote !== 'number' || !Number.isFinite(vote) || vote < 10 || vote > 100) {
    return undefined
  }

  return Math.round(vote) / 10
}

/** Import-side mapping; `Blacklist` (6) marks entries the user rejects. */
export function statusFromVndbLabels(
  labels: readonly { id: number }[] | null | undefined
): LibraryMediaStatus | 'blacklisted' | undefined {
  const ids = new Set((labels ?? []).map((label) => label.id))
  if (ids.has(6)) {
    return 'blacklisted'
  }

  for (const [status, labelId] of Object.entries(VNDB_STATUS_LABEL_BY_STATUS)) {
    if (ids.has(labelId)) {
      return status as LibraryMediaStatus
    }
  }

  return undefined
}
