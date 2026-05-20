import { kisaki, type ExtensionLogger, type LibraryGame } from '@kisaki/extension-sdk'
import type { BangumiClient } from '../api/client'
import { BangumiApiError } from '../api/errors'
import type { BangumiCollectionPatch, BangumiUserCollection } from '../api/types'
import type { BangumiSettingsV1 } from '../config/schema'
import type { SettingsStore } from '../config/store'
import { BangumiExtensionError } from '../shared/errors'
import { createSyncFingerprint, type SyncStateStore } from './fingerprint'
import {
  createSyncMappingOptions,
  createSyncPayloadPlan,
  readBangumiSubjectId,
  syncPayloadMatchesRemote,
  type SyncMappingOverrides
} from './mapping'
import type { SyncSuppressor } from './suppressor'

export type SyncGameResultStatus =
  | 'synced'
  | 'wouldSync'
  | 'skippedNoBangumiId'
  | 'skippedByMapping'
  | 'skippedNoChange'
  | 'skippedSuppressed'
  | 'skippedRemoteExisting'
  | 'skippedMissingLocalGame'

export interface SyncGameResult {
  status: SyncGameResultStatus
  gameId: string
  game?: LibraryGame
  subjectId?: string
  payload?: BangumiCollectionPatch
  fingerprint?: string
  remote?: BangumiUserCollection
  suppressReason?: string
}

export interface SyncGameOptions extends SyncMappingOverrides {
  game?: LibraryGame
  gameId?: string
  dryRun?: boolean
  updateExisting?: boolean
  accountUsername?: string
  checkRemote?: boolean
  signal?: AbortSignal
}

export interface SyncEngineDependencies {
  settingsStore: SettingsStore
  client: BangumiClient
  stateStore: SyncStateStore
  suppressor: SyncSuppressor
  logger?: ExtensionLogger
}

export class SyncEngine {
  constructor(private readonly deps: SyncEngineDependencies) {}

  async syncGame(options: SyncGameOptions): Promise<SyncGameResult> {
    const settings = await this.deps.settingsStore.get()
    const game = options.game ?? (await this.loadGame(options.gameId))
    const gameId = game?.id ?? options.gameId ?? ''

    if (!game) {
      return { status: 'skippedMissingLocalGame', gameId }
    }

    const subjectId = readBangumiSubjectId(game)
    if (!subjectId) {
      return { status: 'skippedNoBangumiId', gameId: game.id, game }
    }

    const mappingOptions = createSyncMappingOptions(settings, options)
    const payloadPlan = createSyncPayloadPlan(game, mappingOptions)
    if (payloadPlan.skippedByMapping) {
      return {
        status: 'skippedByMapping',
        gameId: game.id,
        game,
        subjectId,
        payload: payloadPlan.payload
      }
    }

    const fingerprint = createSyncFingerprint({
      gameId: game.id,
      subjectId,
      playStatusEnabled: mappingOptions.playStatusEnabled,
      mappedType: payloadPlan.mappedType,
      scoreEnabled: mappingOptions.scoreEnabled,
      mappedRate: payloadPlan.mappedRate,
      clearRemoteScoreWhenEmpty: mappingOptions.clearRemoteScoreWhenEmpty,
      payload: payloadPlan.payload
    })

    const suppress = this.deps.suppressor.match(game.id, fingerprint)
    if (suppress) {
      return {
        status: 'skippedSuppressed',
        gameId: game.id,
        game,
        subjectId,
        payload: payloadPlan.payload,
        fingerprint,
        suppressReason: suppress.reason
      }
    }

    const remote = options.checkRemote
      ? await this.getRemoteCollection(options.accountUsername, subjectId, options.signal)
      : undefined

    if (remote && options.updateExisting === false) {
      return {
        status: 'skippedRemoteExisting',
        gameId: game.id,
        game,
        subjectId,
        payload: payloadPlan.payload,
        fingerprint,
        remote
      }
    }

    if (options.checkRemote && syncPayloadMatchesRemote(payloadPlan.payload, remote)) {
      if (!options.dryRun) {
        await this.deps.stateStore.recordSuccessfulSync({
          gameId: game.id,
          subjectId,
          fingerprint,
          updatedAt: Date.now()
        })
      }
      return {
        status: 'skippedNoChange',
        gameId: game.id,
        game,
        subjectId,
        payload: payloadPlan.payload,
        fingerprint,
        remote
      }
    }

    if (!options.checkRemote) {
      const lastFingerprint = await this.deps.stateStore.getLastFingerprint(game.id)
      if (lastFingerprint === fingerprint) {
        return {
          status: 'skippedNoChange',
          gameId: game.id,
          game,
          subjectId,
          payload: payloadPlan.payload,
          fingerprint
        }
      }
    }

    if (options.dryRun) {
      return {
        status: 'wouldSync',
        gameId: game.id,
        game,
        subjectId,
        payload: payloadPlan.payload,
        fingerprint,
        remote
      }
    }

    await this.deps.client.upsertMyCollection(Number(subjectId), payloadPlan.payload, {
      signal: options.signal
    })
    await this.deps.stateStore.recordSuccessfulSync({
      gameId: game.id,
      subjectId,
      fingerprint,
      updatedAt: Date.now()
    })
    this.deps.suppressor.suppressFingerprint(
      game.id,
      fingerprint,
      Math.max(30_000, settings.autoSync.debounceMs * 2)
    )

    return {
      status: 'synced',
      gameId: game.id,
      game,
      subjectId,
      payload: payloadPlan.payload,
      fingerprint,
      remote
    }
  }

  private async loadGame(gameId: string | undefined): Promise<LibraryGame | undefined> {
    if (!gameId) {
      return undefined
    }

    const game = await kisaki.library.games.get(gameId)
    return game ?? undefined
  }

  private async getRemoteCollection(
    username: string | undefined,
    subjectId: string,
    signal?: AbortSignal
  ): Promise<BangumiUserCollection | undefined> {
    if (!username) {
      throw new BangumiExtensionError('auth_required', '请先登录 Bangumi 账号。')
    }

    try {
      return await this.deps.client.getUserCollection(username, Number(subjectId), { signal })
    } catch (error) {
      if (error instanceof BangumiApiError && error.status === 404) {
        return undefined
      }
      throw error
    }
  }
}
