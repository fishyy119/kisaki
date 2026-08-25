import { formatScopedCollectionType } from '../media/labels'
import type { BangumiMediaScope } from '../../shared/scopes'
import { readBangumiSubjectIdFromExternalIds } from '../identity/subject-ref'
import { isCancellationError } from '@kisaki3/extension-sdk'
import { m } from '../i18n'
import { BangumiExtensionError } from '../utils/errors'
import { omitUndefined } from '../utils/object'
import type { SyncItemResult } from '../sync/engine'
import type { BangumiChangedItemsSyncArgs, BangumiFullSyncArgs } from './args'
import {
  JobStateController,
  runBangumiJob,
  type BangumiJobRun,
  type JobRunnerDependencies
} from './context'
import { createPreviewGroup } from './presentation'
import type { BangumiJobPreviewGroup, BangumiJobPreviewRow } from '../../shared/settings'
import type { BangumiJobSummary } from './summary'

interface CollectedFullSync {
  scope: BangumiMediaScope
  supported: boolean
  scanned: number
  operations: readonly SyncItemResult[]
}

export class SyncJobRunner {
  constructor(private readonly deps: JobRunnerDependencies) {}

  runChangedItemsSync(
    args: BangumiChangedItemsSyncArgs,
    context: BangumiJobRun
  ): Promise<BangumiJobSummary> {
    return runBangumiJob(context, this.deps.logger, async (job) => {
      const descriptor = this.deps.mediaRegistry.require(args.scope)
      job.report('loadingQueue', m().jobs.sync.loadingQueue, { indeterminate: true })
      await job.checkpoint()

      const queueItems = await this.deps.syncQueueStore.list(args.limit, args.scope)
      job.increment('queued', queueItems.length)

      if (!descriptor.localAdapter?.supportsAutoSync) {
        job.increment('skippedUnsupportedScope', queueItems.length || 1)
        job.report('completed', m().jobs.sync.queueUnsupported({ scope: descriptor.scope }), {
          current: queueItems.length,
          total: queueItems.length
        })
        return
      }

      let processedQueuedItems = 0
      for (const item of queueItems) {
        await job.checkpoint()

        let countProcessed = true
        try {
          const result = await this.deps.syncEngine.syncItem({
            scope: item.scope,
            localId: item.localId,
            signal: job.signal
          })
          recordSyncItemResult(job, result)
          await this.syncEpisodes(job, item.scope, item.localId)

          await this.deps.syncQueueStore.remove([item])
        } catch (error) {
          if (isCancellationError(error) || job.signal.aborted || shouldStopSyncBatch(error)) {
            countProcessed = false
            throw error
          }

          job.addError(error, { scope: item.scope, localId: item.localId })
          incrementSyncFailure(job, error)
        } finally {
          if (countProcessed) {
            processedQueuedItems += 1
            job.report('syncingQueuedItems', m().jobs.sync.syncingQueue, {
              current: processedQueuedItems,
              total: queueItems.length
            })
          }
        }
      }

      const message = m().jobs.sync.queueCompleted({ count: job.counters.synced ?? 0 })
      job.report('completed', message, {
        current: queueItems.length,
        total: queueItems.length
      })
    })
  }

  runFullSync(args: BangumiFullSyncArgs, context: BangumiJobRun): Promise<BangumiJobSummary> {
    return runBangumiJob(context, this.deps.logger, async (job) => {
      const collected = await this.collectFullSync(args, job, { includePreview: false })
      if (!collected.supported) {
        return
      }
      await this.executeFullSync(job, collected)

      const message = m().jobs.sync.fullCompleted({
        count: job.counters.synced ?? 0,
        scope: collected.scope
      })
      job.report('completed', message, {
        current: job.counters.synced ?? 0,
        total: collected.operations.length
      })
    })
  }

  previewFullSync(args: BangumiFullSyncArgs, context: BangumiJobRun): Promise<BangumiJobSummary> {
    return runBangumiJob(context, this.deps.logger, async (job) => {
      const collected = await this.collectFullSync(args, job, { includePreview: true })
      if (!collected.supported) {
        return
      }

      const message = m().jobs.sync.previewCompleted({
        count: job.counters.wouldSync ?? 0,
        scope: collected.scope
      })
      job.report('completed', message, {
        current: collected.scanned,
        total: collected.scanned
      })
    })
  }

  private async collectFullSync(
    args: BangumiFullSyncArgs,
    job: JobStateController,
    options: { includePreview: boolean }
  ): Promise<CollectedFullSync> {
    const descriptor = this.deps.mediaRegistry.require(args.scope)
    const adapter = descriptor.localAdapter
    if (!adapter?.supportsAutoSync) {
      job.increment('skippedUnsupportedScope')
      job.report('completed', m().jobs.sync.fullUnsupported({ scope: descriptor.scope }), {
        current: 1,
        total: 1
      })
      return { scope: descriptor.scope, supported: false, scanned: 0, operations: [] }
    }

    const settings = await this.deps.settingsStore.get()
    const account = await this.requireAccount()
    const playStatusEnabled = args.playStatusEnabled ?? settings.autoSync.playStatusEnabled
    const scoreEnabled = args.scoreEnabled ?? settings.autoSync.scoreEnabled
    const operations: SyncItemResult[] = []
    let offset = 0
    let scanned = 0

    job.increment('selectedSyncFields', Number(playStatusEnabled) + Number(scoreEnabled))

    while (true) {
      await job.checkpoint()
      job.report('loadingItems', m().jobs.sync.scanningItems({ scope: descriptor.scope }), {
        current: scanned,
        indeterminate: true
      })

      const items = await adapter.listLocalItems({
        includeNsfw: true,
        limit: args.batchSize,
        offset
      })

      if (items.length === 0) {
        break
      }

      for (const item of items) {
        await job.checkpoint()
        let countScanned = true
        try {
          const result = await this.deps.syncEngine.collectItem(
            omitUndefined({
              scope: args.scope,
              item,
              updateExisting: args.updateExisting,
              accountUsername: account.username,
              checkRemote: true,
              playStatusEnabled: args.playStatusEnabled,
              scoreEnabled: args.scoreEnabled,
              clearRemoteScoreWhenEmpty: args.clearRemoteScoreWhenEmpty,
              signal: job.signal
            })
          )
          recordSyncItemResult(job, result, { includePreview: options.includePreview })

          if (result.status === 'wouldSync') {
            operations.push(result)
          } else if (!options.includePreview) {
            await this.deps.syncEngine.applyItem(result, { signal: job.signal })
          }

          if (!options.includePreview && args.episodeStatusEnabled !== false) {
            await this.syncEpisodes(job, args.scope, item.localId)
          }
        } catch (error) {
          if (isCancellationError(error) || job.signal.aborted || shouldStopSyncBatch(error)) {
            countScanned = false
            throw error
          }

          job.addError(error, {
            scope: args.scope,
            localId: item.localId,
            subjectId: readBangumiSubjectIdFromExternalIds(item) ?? null
          })
          incrementSyncFailure(job, error)
        } finally {
          if (countScanned) {
            scanned += 1
            job.increment('scanned')
            job.report(
              options.includePreview ? 'previewingFullSyncItems' : 'collectingFullSyncItems',
              options.includePreview
                ? m().jobs.sync.previewingItems
                : m().jobs.sync.collectingItems({ scope: args.scope }),
              {
                current: scanned,
                indeterminate: true
              }
            )
          }
        }
      }

      offset += items.length
      if (items.length < args.batchSize) {
        break
      }
    }

    return {
      scope: descriptor.scope,
      supported: true,
      scanned,
      operations
    }
  }

  private async executeFullSync(
    job: JobStateController,
    collected: CollectedFullSync
  ): Promise<void> {
    if (collected.operations.length <= 0) {
      return
    }

    job.report('syncingFullSyncItems', m().jobs.sync.applyingItems, {
      current: 0,
      total: collected.operations.length,
      ratePeriod: 'minute'
    })

    for (const [index, result] of collected.operations.entries()) {
      await job.checkpoint()
      try {
        const applied = await this.deps.syncEngine.applyItem(result, { signal: job.signal })
        if (applied.status === 'synced') {
          job.increment('synced')
        }
      } catch (error) {
        if (isCancellationError(error) || job.signal.aborted || shouldStopSyncBatch(error)) {
          throw error
        }

        job.addError(error, {
          scope: result.scope,
          localId: result.localId,
          subjectId: result.subjectId ?? null
        })
        incrementSyncFailure(job, error)
      } finally {
        job.report('syncingFullSyncItems', m().jobs.sync.applyingItems, {
          current: index + 1,
          total: collected.operations.length,
          ratePeriod: 'minute'
        })
      }
    }
  }

  /**
   * Flushes per-episode watch state for one entry. Scopes without episodes and
   * disabled episode sync resolve to a no-op inside the engine.
   */
  private async syncEpisodes(
    job: JobStateController,
    scope: BangumiMediaScope,
    localId: string
  ): Promise<void> {
    const result = await this.deps.episodeSyncEngine.syncEpisodes({
      scope,
      localId,
      signal: job.signal
    })

    if (result.status === 'synced') {
      job.increment('syncedEpisodes', (result.markedCount ?? 0) + (result.unmarkedCount ?? 0))
    }
  }

  private async requireAccount() {
    const account = await this.deps.accountService.getAccountSnapshot()
    if (!account) {
      throw new BangumiExtensionError('auth_required', m().errors.authRequired)
    }
    return account
  }
}

function recordSyncItemResult(
  job: JobStateController,
  result: SyncItemResult,
  options: { includePreview: boolean } = { includePreview: false }
): void {
  if (result.subjectId) {
    job.increment('withBangumiId')
  }

  switch (result.status) {
    case 'synced':
      job.increment('synced')
      return
    case 'wouldSync': {
      const previewGroup = createFullSyncPreviewChange(result)
      if (options.includePreview && previewGroup) {
        job.addPreviewGroup(previewGroup)
      }
      if (options.includePreview) {
        job.increment('wouldSync')
      }
      return
    }
    case 'skippedNoBangumiId':
      job.increment('skippedNoBangumiId')
      return
    case 'skippedByMapping':
      job.increment('skippedByMapping')
      return
    case 'skippedNoChange':
      job.increment('skippedNoChange')
      return
    case 'skippedSuppressed':
      job.increment('skippedSuppressed')
      return
    case 'skippedRemoteExisting':
      job.increment('skippedRemoteExisting')
      return
    case 'skippedMissingLocalItem':
      job.increment('skippedMissingLocalItem')
      return
    case 'skippedUnsupportedScope':
      job.increment('skippedUnsupportedScope')
      return
    case 'skippedLocalSyncDisabled':
      job.increment('skippedLocalSyncDisabled')
      return
  }
}

function createFullSyncPreviewChange(result: SyncItemResult): BangumiJobPreviewGroup | undefined {
  const { item, subjectId, remote, payload } = result
  if (!item || !subjectId || !payload) {
    return undefined
  }

  const rows: BangumiJobPreviewRow[] = []

  if (payload.type !== undefined) {
    rows.push({
      label: m().jobs.preview.collectionStatus,
      before: remote
        ? formatScopedCollectionType(result.scope, remote.type)
        : m().jobs.preview.notCollected,
      after: formatScopedCollectionType(result.scope, payload.type),
      tone: remote ? 'info' : 'success'
    })
  }

  const remoteScore = normalizeBangumiRate(remote?.rate)
  if (payload.rate !== undefined && (payload.rate !== 0 || remoteScore !== undefined)) {
    rows.push({
      label: m().jobs.preview.score,
      before: remoteScore === undefined ? m().jobs.preview.notRated : `${remoteScore}`,
      after: formatSyncPayloadRate(payload.rate),
      tone: payload.rate === 0 ? 'warning' : remote ? 'info' : 'success'
    })
  }

  if (payload.vol_status !== undefined || payload.ept_status !== undefined) {
    rows.push({
      label: m().jobs.preview.unitProgress,
      before: m().jobs.preview.unitProgressValue({
        volumes: remote?.vol_status ?? 0,
        chapters: remote?.ept_status ?? 0
      }),
      after: m().jobs.preview.unitProgressValue({
        volumes: payload.vol_status ?? remote?.vol_status ?? 0,
        chapters: payload.ept_status ?? remote?.ept_status ?? 0
      }),
      tone: remote ? 'info' : 'success'
    })
  }

  if (rows.length === 0) {
    return undefined
  }

  return createPreviewGroup({
    title: item.name,
    subjectId,
    badge: {
      label: remote
        ? m().jobs.preview.updateRemoteCollectionBadge
        : m().jobs.preview.createRemoteCollectionBadge,
      tone: remote ? 'info' : 'success'
    },
    rows
  })
}

function normalizeBangumiRate(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.min(10, Math.max(1, Math.trunc(value)))
    : undefined
}

function formatSyncPayloadRate(rate: number): string {
  return rate === 0 ? m().jobs.preview.notRated : `${rate}`
}

function shouldStopSyncBatch(error: unknown): boolean {
  return (
    error instanceof BangumiExtensionError &&
    (error.code === 'auth_required' || error.code === 'auth_expired')
  )
}

function incrementSyncFailure(job: JobStateController, error: unknown): void {
  if (error instanceof BangumiExtensionError) {
    switch (error.code) {
      case 'auth_required':
      case 'auth_expired':
        job.increment('failedAuth')
        return
      case 'bangumi_validation':
      case 'bangumi_not_found':
        job.increment('failedValidation')
        return
      case 'bangumi_rate_limited':
      case 'network_failed':
        job.increment('failedNetwork')
        return
      case 'local_media_unsupported':
        job.increment('skippedUnsupportedScope')
        return
    }
  }

  job.increment('failedUnknown')
}
