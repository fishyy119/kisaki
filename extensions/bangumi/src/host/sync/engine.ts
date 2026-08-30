import type { ExtensionLogger } from '@kisaki3/extension-sdk'
import type { BangumiClient } from '../api/client'
import { BangumiApiError } from '../api/errors'
import type { BangumiCollectionPatch, BangumiUserCollection } from '../api/types'
import type { BangumiMediaScope } from '../../shared/scopes'
import type { LocalMediaItem } from '../media/types'
import type { MediaRegistry } from '../media/registry'
import type { BangumiSettingsStore } from '../config/schema'
import {
  createBangumiSubjectRef,
  readBangumiSubjectIdFromExternalIds
} from '../identity/subject-ref'
import { BangumiExtensionError } from '../utils/errors'
import { m } from '../i18n'
import { createSyncFingerprint, type SyncStateStore } from './fingerprint'
import {
  createSyncMappingOptions,
  createSyncPayloadPlan,
  syncPayloadMatchesRemote,
  type SyncMappingOverrides
} from './mapping'
export type SyncItemResultStatus =
  | 'synced'
  | 'wouldSync'
  | 'skippedNoRemoteId'
  | 'skippedByMapping'
  | 'skippedNoChange'
  | 'skippedRemoteExisting'
  | 'skippedMissingLocalItem'
  | 'skippedUnsupportedScope'
  | 'skippedLocalSyncDisabled'

export interface SyncItemResult {
  status: SyncItemResultStatus
  scope: BangumiMediaScope
  localId: string
  item?: LocalMediaItem | undefined
  subjectId?: string | undefined
  payload?: BangumiCollectionPatch | undefined
  fingerprint?: string | undefined
  remote?: BangumiUserCollection | undefined
}

export interface SyncItemOptions extends SyncMappingOverrides {
  scope: BangumiMediaScope
  item?: LocalMediaItem | undefined
  localId?: string | undefined
  updateExisting?: boolean | undefined
  accountUsername?: string | undefined
  checkRemote?: boolean | undefined
  signal?: AbortSignal | undefined
}

export interface SyncEngineDependencies {
  settingsStore: BangumiSettingsStore
  client: BangumiClient
  mediaRegistry: MediaRegistry
  stateStore: SyncStateStore
  logger?: ExtensionLogger
}

export class SyncEngine {
  constructor(private readonly deps: SyncEngineDependencies) {}

  async syncItem(options: SyncItemOptions): Promise<SyncItemResult> {
    const result = await this.collectItem(options)
    return this.applyItem(result, { signal: options.signal })
  }

  async collectItem(options: SyncItemOptions): Promise<SyncItemResult> {
    const settings = await this.deps.settingsStore.get()
    const descriptor = this.deps.mediaRegistry.require(options.scope)
    const adapter = descriptor.localAdapter
    const localId = options.item?.localId ?? options.localId ?? ''

    if (!adapter || !adapter.supportsAutoSync) {
      return { status: 'skippedUnsupportedScope', scope: options.scope, localId }
    }

    if (!settings.media[options.scope].localSyncEnabled) {
      return { status: 'skippedLocalSyncDisabled', scope: options.scope, localId }
    }

    const item = options.item ?? (localId ? await adapter.getLocalItem(localId) : null)
    if (!item) {
      return { status: 'skippedMissingLocalItem', scope: options.scope, localId }
    }

    const subjectId = readBangumiSubjectIdFromExternalIds(item)
    if (!subjectId) {
      return { status: 'skippedNoRemoteId', scope: options.scope, localId: item.localId, item }
    }

    const mappingOptions = createSyncMappingOptions(settings, options)
    const payloadPlan = createSyncPayloadPlan(item, mappingOptions)
    if (payloadPlan.skippedByMapping) {
      return {
        status: 'skippedByMapping',
        scope: options.scope,
        localId: item.localId,
        item,
        subjectId,
        payload: payloadPlan.payload
      }
    }

    const fingerprint = createSyncFingerprint({
      scope: options.scope,
      localId: item.localId,
      subjectId,
      playStatusEnabled: mappingOptions.playStatusEnabled,
      mappedType: payloadPlan.mappedType,
      scoreEnabled: mappingOptions.scoreEnabled,
      mappedRate: payloadPlan.mappedRate,
      clearRemoteScoreWhenEmpty: mappingOptions.clearRemoteScoreWhenEmpty,
      payload: payloadPlan.payload
    })

    const subjectRef = createBangumiSubjectRef(options.scope, subjectId)
    const remote = options.checkRemote
      ? await this.getRemoteCollection(options.accountUsername, subjectRef, options.signal)
      : undefined

    if (remote && options.updateExisting === false) {
      return {
        status: 'skippedRemoteExisting',
        scope: options.scope,
        localId: item.localId,
        item,
        subjectId,
        payload: payloadPlan.payload,
        fingerprint,
        remote
      }
    }

    if (options.checkRemote && syncPayloadMatchesRemote(payloadPlan.payload, remote)) {
      return {
        status: 'skippedNoChange',
        scope: options.scope,
        localId: item.localId,
        item,
        subjectId,
        payload: payloadPlan.payload,
        fingerprint,
        remote
      }
    }

    if (!options.checkRemote) {
      const lastFingerprint = await this.deps.stateStore.getLastFingerprint(
        options.scope,
        item.localId
      )
      if (lastFingerprint === fingerprint) {
        return {
          status: 'skippedNoChange',
          scope: options.scope,
          localId: item.localId,
          item,
          subjectId,
          payload: payloadPlan.payload,
          fingerprint
        }
      }
    }

    return {
      status: 'wouldSync',
      scope: options.scope,
      localId: item.localId,
      item,
      subjectId,
      payload: payloadPlan.payload,
      fingerprint,
      remote
    }
  }

  async applyItem(
    result: SyncItemResult,
    options: { signal?: AbortSignal | undefined } = {}
  ): Promise<SyncItemResult> {
    if (result.status === 'skippedNoChange' && result.remote) {
      await this.recordSuccessfulNoChange(result)
      return result
    }

    if (
      result.status !== 'wouldSync' ||
      !result.subjectId ||
      !result.payload ||
      !result.fingerprint
    ) {
      return result
    }

    await this.deps.client.upsertMyCollection(
      createBangumiSubjectRef(result.scope, result.subjectId),
      result.payload,
      {
        signal: options.signal
      }
    )
    await this.deps.stateStore.recordSuccessfulSync({
      scope: result.scope,
      localId: result.localId,
      subjectId: result.subjectId,
      fingerprint: result.fingerprint,
      updatedAt: Date.now()
    })

    return {
      ...result,
      status: 'synced'
    }
  }

  private async recordSuccessfulNoChange(result: SyncItemResult): Promise<void> {
    if (!result.subjectId || !result.fingerprint) {
      return
    }

    await this.deps.stateStore.recordSuccessfulSync({
      scope: result.scope,
      localId: result.localId,
      subjectId: result.subjectId,
      fingerprint: result.fingerprint,
      updatedAt: Date.now()
    })
  }

  private async getRemoteCollection(
    username: string | undefined,
    subjectRef: ReturnType<typeof createBangumiSubjectRef>,
    signal?: AbortSignal
  ): Promise<BangumiUserCollection | undefined> {
    if (!username) {
      throw new BangumiExtensionError('auth_required', m().errors.authRequired)
    }

    try {
      return await this.deps.client.getUserCollection(username, subjectRef, { signal })
    } catch (error) {
      if (error instanceof BangumiApiError && error.status === 404) {
        return undefined
      }
      throw error
    }
  }
}
