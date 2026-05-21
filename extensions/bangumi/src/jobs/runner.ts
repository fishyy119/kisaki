import type { CommandContributionExecuteEvent, ExtensionLogger } from '@kisaki/extension-sdk'
import type { BangumiClient } from '../api/client'
import type { BangumiIndexSubject, BangumiUserCollection } from '../api/types'
import type { AccountService } from '../auth/account'
import type { TokenService } from '../auth/token-service'
import type { BangumiCollectionType } from '../config/schema'
import type { SettingsStore } from '../config/store'
import { CollectionReader } from '../import/collection-reader'
import { ImportExecutor } from '../import/executor'
import { IndexReader } from '../import/index-reader'
import {
  ImportPlanner,
  type CollectionImportPlanItem,
  type IndexImportPlanItem
} from '../import/planner'
import { BANGUMI_SOURCE_ID } from '../shared/constants'
import { BangumiExtensionError } from '../shared/errors'
import { formatScopedCollectionType, getMediaScopeLabel } from '../media/labels'
import type { BangumiMediaScope } from '../media/scopes'
import type { MediaRegistry } from '../media/registry'
import type {
  LocalCollectionTarget,
  LocalMediaAdapter,
  LocalMediaItem,
  LocalMediaUserPatch
} from '../media/types'
import { readBangumiSubjectId } from '../media/game/mapping'
import type { SyncEngine, SyncItemResult } from '../sync/engine'
import type { SyncQueueStore } from '../sync/queue'
import { createImportSuppressTtlMs, type SyncSuppressor } from '../sync/suppressor'
import type {
  BangumiAuthRefreshArgs,
  BangumiChangedItemsSyncArgs,
  BangumiFullSyncArgs,
  BangumiImportCollectionsArgs,
  BangumiImportIndexArgs,
  BangumiImportTargetCollection
} from './args'
import {
  createBangumiJobSummary,
  createJobError,
  isCancellationError,
  type BangumiJobError,
  type BangumiJobPreviewGroup,
  type BangumiJobPreviewRow,
  type BangumiJobSummary
} from './summary'

export interface JobRunnerDependencies {
  settingsStore: SettingsStore
  client: BangumiClient
  tokenService: TokenService
  accountService: AccountService
  syncEngine: SyncEngine
  mediaRegistry: MediaRegistry
  syncQueueStore: SyncQueueStore
  syncSuppressor: SyncSuppressor
  logger?: ExtensionLogger
}

interface JobCounters {
  [key: string]: number
}

interface JobState {
  commandId: string
  startedAt: number
  dryRun: boolean
  counters: JobCounters
  previewGroups: BangumiJobPreviewGroup[]
  errors: BangumiJobError[]
  event: CommandContributionExecuteEvent
}

interface CollectionLocalUpdatePlan {
  patch: LocalMediaUserPatch
  tagNames: readonly string[]
  targetCollection?: LocalCollectionTarget
  rows: readonly BangumiJobPreviewRow[]
}

export class JobRunner {
  private readonly collectionReader: CollectionReader
  private readonly indexReader: IndexReader
  private readonly importPlanner: ImportPlanner
  private readonly importExecutor: ImportExecutor

  constructor(private readonly deps: JobRunnerDependencies) {
    this.collectionReader = new CollectionReader(deps.client)
    this.indexReader = new IndexReader(deps.client)
    this.importPlanner = new ImportPlanner()
    this.importExecutor = new ImportExecutor(deps.mediaRegistry)
  }

  async runAuthRefresh(
    args: BangumiAuthRefreshArgs,
    event: CommandContributionExecuteEvent
  ): Promise<BangumiJobSummary> {
    return this.runJob(event, args.dryRun, async (job) => {
      job.report('refreshingToken', '正在刷新 Bangumi 凭据...', { indeterminate: true })

      if (args.forceRefresh) {
        await this.deps.tokenService.refreshAccessToken({
          forceRefresh: true,
          signal: event.signal
        })
        job.increment('refreshed')
      } else {
        await this.deps.tokenService.getAccessToken({ signal: event.signal })
        job.increment('checkedToken')
      }

      if (args.verifyAccount) {
        job.report('verifyingAccount', '正在验证 Bangumi 账号...', { indeterminate: true })
        const verification = await this.deps.accountService.verifyAccount(event.signal)
        job.increment('verified')
        job.report('completed', `Bangumi 账号有效：${verification.account.nickname}`, {
          current: 1,
          total: 1
        })
      } else {
        const account = await this.deps.accountService.refreshAccount(event.signal)
        job.increment('accountRefreshed')
        job.report('completed', `Bangumi 账号摘要已更新：${account.nickname}`, {
          current: 1,
          total: 1
        })
      }
    })
  }

  async runChangedItemsSync(
    args: BangumiChangedItemsSyncArgs,
    event: CommandContributionExecuteEvent
  ): Promise<BangumiJobSummary> {
    return this.runJob(event, args.dryRun, async (job) => {
      const descriptor = this.deps.mediaRegistry.require(args.scope)
      job.report('loadingQueue', '正在读取 Bangumi 变更同步队列...', { indeterminate: true })
      assertNotCancelled(event.signal)

      const queueItems = await this.deps.syncQueueStore.list(args.limit, args.scope)
      job.increment('queued', queueItems.length)

      if (!descriptor.localAdapter?.supportsAutoSync) {
        job.increment('skippedUnsupportedScope', queueItems.length || 1)
        job.report('completed', `${descriptor.label}暂不支持本地变更同步。`, {
          current: queueItems.length,
          total: queueItems.length
        })
        return
      }

      for (const [index, item] of queueItems.entries()) {
        assertNotCancelled(event.signal)
        job.report('syncingQueuedItems', '正在同步 Bangumi 变更队列...', {
          current: index + 1,
          total: queueItems.length
        })

        try {
          const result = await this.deps.syncEngine.syncItem({
            scope: item.scope,
            localId: item.localId,
            dryRun: args.dryRun,
            signal: event.signal
          })
          recordSyncItemResult(job, result, args.dryRun)

          if (!args.dryRun) {
            await this.deps.syncQueueStore.remove([item])
          }
        } catch (error) {
          if (isCancellationError(error) || event.signal.aborted || shouldStopSyncBatch(error)) {
            throw error
          }

          job.addError(error, { scope: item.scope, localId: item.localId })
          incrementSyncFailure(job, error)
        }
      }

      const message = args.dryRun
        ? `变更队列预览完成：${job.counters.wouldSync ?? 0} 个条目可同步。`
        : `变更队列同步完成：${job.counters.synced ?? 0} 个条目已同步。`
      job.report('completed', message, {
        current: queueItems.length,
        total: queueItems.length
      })
    })
  }

  async runFullSync(
    args: BangumiFullSyncArgs,
    event: CommandContributionExecuteEvent
  ): Promise<BangumiJobSummary> {
    return this.runJob(event, args.dryRun, async (job) => {
      const descriptor = this.deps.mediaRegistry.require(args.scope)
      const adapter = descriptor.localAdapter
      if (!adapter?.supportsAutoSync) {
        job.increment('skippedUnsupportedScope')
        job.report('completed', `${descriptor.label}暂不支持本地全量同步。`, {
          current: 1,
          total: 1
        })
        return
      }

      const settings = await this.deps.settingsStore.get()
      const account = await this.requireAccount()
      const playStatusEnabled = args.playStatusEnabled ?? settings.game.autoSync.playStatusEnabled
      const scoreEnabled = args.scoreEnabled ?? settings.game.autoSync.scoreEnabled
      let offset = 0
      let processed = 0

      job.increment('selectedSyncFields', Number(playStatusEnabled) + Number(scoreEnabled))

      while (true) {
        assertNotCancelled(event.signal)
        job.report('loadingItems', `正在扫描${descriptor.label}...`, {
          current: processed,
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
          assertNotCancelled(event.signal)
          processed += 1
          job.increment('processed')
          job.report(
            args.dryRun ? 'previewingFullSyncItems' : 'syncingFullSyncItems',
            args.dryRun ? '正在预览 Bangumi 全量同步...' : '正在同步 Bangumi 全量条目...',
            {
              current: processed,
              indeterminate: true
            }
          )

          try {
            const result = await this.deps.syncEngine.syncItem({
              scope: args.scope,
              item,
              dryRun: args.dryRun,
              updateExisting: args.updateExisting,
              accountUsername: account.username,
              checkRemote: true,
              playStatusEnabled: args.playStatusEnabled,
              scoreEnabled: args.scoreEnabled,
              clearRemoteScoreWhenEmpty: args.clearRemoteScoreWhenEmpty,
              signal: event.signal
            })
            recordSyncItemResult(job, result, args.dryRun)
          } catch (error) {
            if (isCancellationError(error) || event.signal.aborted || shouldStopSyncBatch(error)) {
              throw error
            }

            job.addError(error, {
              scope: args.scope,
              localId: item.localId,
              subjectId: readBangumiSubjectId(item) ?? null
            })
            incrementSyncFailure(job, error)
          }
        }

        offset += items.length
        if (items.length < args.batchSize) {
          break
        }
      }

      const label = descriptor.label
      const message = args.dryRun
        ? `全量同步预览完成：${job.counters.wouldSync ?? 0} 个${label}可同步。`
        : `全量同步完成：${job.counters.synced ?? 0} 个${label}已同步。`
      job.report('completed', message, {
        current: processed,
        total: processed
      })
    })
  }

  async runImportCollections(
    args: BangumiImportCollectionsArgs,
    event: CommandContributionExecuteEvent
  ): Promise<BangumiJobSummary> {
    return this.runJob(event, args.dryRun, async (job) => {
      const descriptor = this.deps.mediaRegistry.require(args.scope)
      const localAdapter = this.importExecutor.getLocalAdapter(args.scope)
      job.report('validating', '正在检查 Bangumi 导入参数...', { indeterminate: true })

      if (!localAdapter?.supportsImportWrite && !args.dryRun) {
        job.increment('skippedUnsupportedScope')
        job.report('completed', `${descriptor.label}暂不支持写入本地库。`, {
          current: 1,
          total: 1
        })
        return
      }

      const account = await this.requireAccount()
      const adapter = args.dryRun
        ? localAdapter
        : this.importExecutor.requireWritableAdapter(args.scope)

      if (adapter && !args.dryRun) {
        await this.requireWritableProfile(adapter, args.profileId)
      }

      const targetCollection = adapter
        ? await resolveTargetCollection(adapter, args.targetCollection)
        : undefined
      job.increment('selectedCollectionTypes', args.collectionTypes.length)
      job.increment('selectedWriteFields', countEnabledFields(args.fields))
      job.increment('patchExisting', args.patchExisting ? 1 : 0)
      job.increment('selectedTargetCollections', targetCollection ? 1 : 0)

      const collections = await this.collectionReader.readUserCollections({
        username: account.username,
        scope: args.scope,
        collectionTypes: args.collectionTypes,
        event,
        report: (phase, message) => job.report(phase, message, { indeterminate: true })
      })

      if (!adapter?.supportsImportWrite) {
        const plan = this.importPlanner.planCollections({
          scope: args.scope,
          collections,
          localWritable: false,
          patchExisting: args.patchExisting,
          fields: args.fields,
          targetCollection
        })
        recordRemoteOnlyImportPreview({
          job,
          scope: args.scope,
          planItems: plan.items,
          dryRun: args.dryRun
        })
        return
      }

      job.report('matchingLocalItems', `正在匹配${descriptor.label}...`, {
        current: 0,
        total: collections.length
      })
      const subjectIds = collections.map(readCollectionSubjectId).filter(Boolean).map(String)
      const localItems = new Map(await adapter.findBySubjectIds(subjectIds))
      const plan = this.importPlanner.planCollections({
        scope: args.scope,
        collections,
        localItems,
        localWritable: true,
        patchExisting: args.patchExisting,
        fields: args.fields,
        targetCollection
      })

      for (const planItem of plan.items) {
        assertNotCancelled(event.signal)
        const { action, collection, subjectId: subjectIdText } = planItem
        if (action.kind === 'error') {
          job.addError(new BangumiExtensionError('bangumi_validation', action.message), {
            scope: args.scope,
            subjectId: action.subjectId
          })
          job.increment('failedItems')
          continue
        }

        if (!subjectIdText) {
          continue
        }

        job.increment('processed')
        reportCollectionImportItemProgress({
          job,
          actionKind: action.kind,
          dryRun: args.dryRun,
          label: descriptor.label,
          current: job.counters.processed ?? 0,
          total: plan.items.length
        })

        try {
          if (action.kind === 'skip') {
            job.increment(
              action.reason === 'existingLocalItem' ? 'skippedExistingLocalItem' : 'skippedItems'
            )
            continue
          }

          if (action.kind === 'patch') {
            const localItem = planItem.localItem
            if (!localItem) {
              throw new BangumiExtensionError('library_update_failed', '本地条目不存在。')
            }
            const change = await createImportCollectionPatchPreviewChange({
              adapter,
              item: localItem,
              collection,
              fields: args.fields,
              targetCollection,
              scope: args.scope
            })

            if (!change) {
              job.increment('skippedNoChange')
              continue
            }

            if (args.dryRun) {
              job.addPreviewGroup(change)
              job.increment('wouldPatch')
            } else {
              await this.suppressImport(args.scope, localItem.localId)
              await applyCollectionLocalUpdate({
                adapter,
                executor: this.importExecutor,
                scope: args.scope,
                item: localItem,
                collection,
                fields: args.fields,
                targetCollection
              })
              job.increment('patchedExisting')
            }
            continue
          }

          if (action.kind === 'create' && args.dryRun) {
            job.addPreviewGroup(
              createImportCollectionCreatePreviewChange({
                collection,
                fields: args.fields,
                targetCollection,
                scope: args.scope
              })
            )
            job.increment('wouldImport')
            continue
          }

          if (action.kind !== 'create') {
            job.increment('skippedItems')
            continue
          }

          const imported = await importItemFromCollection(
            this.importExecutor,
            args.scope,
            args.profileId,
            collection
          )
          await this.suppressImport(args.scope, imported.localId)
          const item = await requireLocalItem(adapter, imported.localId)

          if (imported.isNew) {
            await applyCollectionLocalUpdate({
              adapter,
              executor: this.importExecutor,
              scope: args.scope,
              item,
              collection,
              fields: args.fields,
              targetCollection
            })
            localItems.set(subjectIdText, item)
            job.increment('imported')
          } else if (args.patchExisting) {
            const change = await createImportCollectionPatchPreviewChange({
              adapter,
              item,
              collection,
              fields: args.fields,
              targetCollection,
              scope: args.scope
            })
            if (!change) {
              job.increment('skippedNoChange')
              continue
            }

            await this.suppressImport(args.scope, item.localId)
            await applyCollectionLocalUpdate({
              adapter,
              executor: this.importExecutor,
              scope: args.scope,
              item,
              collection,
              fields: args.fields,
              targetCollection
            })
            localItems.set(subjectIdText, item)
            job.increment('patchedExisting')
          } else {
            job.increment('skippedExistingLocalItem')
          }
        } catch (error) {
          if (isCancellationError(error) || event.signal.aborted) {
            throw error
          }
          job.addError(error, { scope: args.scope, subjectId: subjectIdText })
          job.increment('failedItems')
        }
      }

      const label = descriptor.label
      const message = args.dryRun
        ? `我的收藏导入预览完成：${job.counters.wouldImport ?? 0} 个${label}将导入，${job.counters.wouldPatch ?? 0} 个已有${label}将更新。`
        : `我的收藏导入完成：新增 ${job.counters.imported ?? 0} 个${label}，更新 ${job.counters.patchedExisting ?? 0} 个已有${label}。`
      job.report('completed', message, {
        current: job.counters.processed ?? collections.length,
        total: job.counters.processed ?? collections.length
      })
    })
  }

  async runImportIndex(
    args: BangumiImportIndexArgs,
    event: CommandContributionExecuteEvent
  ): Promise<BangumiJobSummary> {
    return this.runJob(event, args.dryRun, async (job) => {
      const descriptor = this.deps.mediaRegistry.require(args.scope)
      const localAdapter = this.importExecutor.getLocalAdapter(args.scope)
      job.report('validating', '正在检查 Bangumi 目录导入参数...', { indeterminate: true })

      if (!localAdapter?.supportsImportWrite && !args.dryRun) {
        job.increment('skippedUnsupportedScope')
        job.report('completed', `${descriptor.label}暂不支持写入本地库。`, {
          current: 1,
          total: 1
        })
        return
      }

      const adapter = args.dryRun
        ? localAdapter
        : this.importExecutor.requireWritableAdapter(args.scope)

      if (adapter && !args.dryRun) {
        await this.requireWritableProfile(adapter, args.profileId)
      }

      job.increment('indices')
      job.increment('patchExisting', args.patchExisting ? 1 : 0)
      const index = await this.indexReader.readIndex(args.indexId, event)
      const targetCollection = adapter
        ? await resolveIndexTargetCollection(adapter, args.targetCollection, index.title)
        : undefined
      job.increment('selectedTargetCollections', targetCollection ? 1 : 0)
      const subjects = await this.indexReader.readIndexSubjects({
        indexId: args.indexId,
        scope: args.scope,
        event,
        report: (phase, message) => job.report(phase, message, { indeterminate: true })
      })
      job.increment('indexSubjects', subjects.length)

      if (!adapter?.supportsImportWrite) {
        const plan = this.importPlanner.planIndexSubjects({
          scope: args.scope,
          subjects,
          localWritable: false,
          patchExisting: args.patchExisting,
          targetCollection
        })
        recordRemoteOnlyIndexPreview({
          job,
          scope: args.scope,
          planItems: plan.items,
          dryRun: args.dryRun
        })
        return
      }

      job.report('matchingLocalItems', `正在匹配${descriptor.label}...`, {
        current: 0,
        total: subjects.length
      })
      const subjectIds = subjects
        .map((subject) => normalizePositiveInteger(subject.id))
        .filter((subjectId): subjectId is number => !!subjectId)
        .map(String)
      const localItems = new Map(await adapter.findBySubjectIds(subjectIds))
      const plan = this.importPlanner.planIndexSubjects({
        scope: args.scope,
        subjects,
        localItems,
        localWritable: true,
        patchExisting: args.patchExisting,
        targetCollection
      })

      for (const planItem of plan.items) {
        assertNotCancelled(event.signal)
        const { action, subject, subjectId: subjectIdText } = planItem
        if (action.kind === 'error') {
          job.addError(new BangumiExtensionError('bangumi_validation', action.message), {
            scope: args.scope,
            subjectId: action.subjectId
          })
          job.increment('failedItems')
          continue
        }

        if (!subjectIdText) {
          continue
        }

        const subjectId = Number(subjectIdText)
        job.increment('processed')
        reportIndexImportItemProgress({
          job,
          actionKind: action.kind,
          dryRun: args.dryRun,
          label: descriptor.label,
          current: job.counters.processed ?? 0,
          total: plan.items.length
        })

        try {
          if (action.kind === 'skip') {
            job.increment(
              action.reason === 'existingLocalItem' ? 'skippedExistingLocalItem' : 'skippedItems'
            )
            continue
          }

          if (action.kind === 'unsupported') {
            job.increment('skippedUnsupportedScope')
            continue
          }

          if (action.kind === 'patch') {
            const localItem = planItem.localItem
            if (!localItem) {
              throw new BangumiExtensionError('library_update_failed', '本地条目不存在。')
            }
            if (!targetCollection) {
              throw new BangumiExtensionError('bangumi_validation', '请选择目标合集。')
            }
            const change = await createIndexCollectionPatchPreviewChange(
              adapter,
              localItem,
              subjectId,
              targetCollection
            )
            if (!change) {
              job.increment('skippedNoChange')
              continue
            }

            if (args.dryRun) {
              job.addPreviewGroup(change)
              job.increment('wouldPatch')
            } else {
              await this.suppressImport(args.scope, localItem.localId)
              await this.importExecutor.ensureInCollection(
                args.scope,
                localItem.localId,
                targetCollection
              )
              job.increment('patchedExisting')
            }
            continue
          }

          if (action.kind === 'create' && args.dryRun) {
            job.addPreviewGroup(
              createIndexCreatePreviewChange(subject, targetCollection, args.scope)
            )
            job.increment('wouldImport')
            continue
          }

          if (action.kind !== 'create') {
            job.increment('skippedItems')
            continue
          }

          const imported = await importItemFromIndexSubject(
            this.importExecutor,
            args.scope,
            args.profileId,
            subject
          )
          await this.suppressImport(args.scope, imported.localId)
          const item = await requireLocalItem(adapter, imported.localId)
          if (targetCollection && imported.isNew) {
            await this.importExecutor.ensureInCollection(args.scope, item.localId, targetCollection)
          }

          if (imported.isNew) {
            localItems.set(subjectIdText, item)
            job.increment('imported')
          } else if (args.patchExisting && targetCollection) {
            const change = await createIndexCollectionPatchPreviewChange(
              adapter,
              item,
              subjectId,
              targetCollection
            )
            if (!change) {
              job.increment('skippedNoChange')
              continue
            }

            await this.importExecutor.ensureInCollection(args.scope, item.localId, targetCollection)
            localItems.set(subjectIdText, item)
            job.increment('patchedExisting')
          } else {
            job.increment('skippedExistingLocalItem')
          }
        } catch (error) {
          if (isCancellationError(error) || event.signal.aborted) {
            throw error
          }
          job.addError(error, { scope: args.scope, subjectId: subjectIdText })
          job.increment('failedItems')
        }
      }

      const label = descriptor.label
      const message = args.dryRun
        ? `目录导入预览完成：${job.counters.wouldImport ?? 0} 个${label}将导入，${job.counters.wouldPatch ?? 0} 个已有${label}将更新。`
        : `目录导入完成：新增 ${job.counters.imported ?? 0} 个${label}，更新 ${job.counters.patchedExisting ?? 0} 个已有${label}。`
      job.report('completed', message, {
        current: job.counters.processed ?? subjects.length,
        total: job.counters.processed ?? subjects.length
      })
    })
  }

  private async runJob(
    event: CommandContributionExecuteEvent,
    dryRun: boolean,
    execute: (job: JobStateController) => Promise<void>
  ): Promise<BangumiJobSummary> {
    const state: JobState = {
      commandId: event.commandId,
      startedAt: Date.now(),
      dryRun,
      counters: {},
      previewGroups: [],
      errors: [],
      event
    }
    const job = new JobStateController(state)

    try {
      assertNotCancelled(event.signal)
      await execute(job)
      assertNotCancelled(event.signal)
      return createBangumiJobSummary({
        commandId: state.commandId,
        startedAt: state.startedAt,
        status: 'completed',
        dryRun: state.dryRun,
        counters: state.counters,
        previewGroups: state.previewGroups,
        errors: state.errors
      })
    } catch (error) {
      if (isCancellationError(error) || event.signal.aborted) {
        job.report('cancelled', 'Bangumi job 已取消。', { indeterminate: true })
        throw new BangumiExtensionError('job_cancelled', 'Bangumi job 已取消。')
      }

      state.errors.push(createJobError(error))
      const message = toUserErrorMessage(error)
      job.report('failed', message, { indeterminate: true })
      this.deps.logger?.warn('Bangumi job failed.', toSafeErrorLog(error))
      throw error
    }
  }

  private async requireWritableProfile(
    adapter: LocalMediaAdapter,
    profileId: string | undefined
  ): Promise<void> {
    const normalizedProfileId = profileId?.trim()
    if (!normalizedProfileId) {
      throw new BangumiExtensionError('profile_missing', '请选择用于创建游戏的刮削配置。')
    }

    const profiles = (await adapter.listProfiles?.()) ?? []
    if (!profiles.some((profile) => profile.id === normalizedProfileId)) {
      throw new BangumiExtensionError('profile_missing', '选择的游戏刮削配置不存在。')
    }
  }

  private async suppressImport(scope: BangumiMediaScope, localId: string): Promise<void> {
    const settings = await this.deps.settingsStore.get()
    this.deps.syncSuppressor.suppressImport(
      scope,
      localId,
      createImportSuppressTtlMs(settings.game.autoSync.debounceMs)
    )
  }

  private async requireAccount() {
    const account = await this.deps.accountService.getAccountSnapshot()
    if (!account) {
      throw new BangumiExtensionError('auth_required', '请先登录 Bangumi 账号。')
    }
    return account
  }
}

class JobStateController {
  constructor(private readonly state: JobState) {}

  get counters(): JobCounters {
    return this.state.counters
  }

  increment(key: string, amount = 1): void {
    this.state.counters[key] = (this.state.counters[key] ?? 0) + amount
  }

  addPreviewGroup(group: BangumiJobPreviewGroup): void {
    this.state.previewGroups.push(group)
  }

  addError(error: unknown, context: Partial<BangumiJobError> = {}): void {
    this.state.errors.push(createJobError(error, context))
  }

  report(
    phase: string,
    message: string,
    progress: { current?: number; total?: number; indeterminate?: boolean } = {}
  ): void {
    this.state.event.reportProgress({
      phase,
      message,
      ...progress
    })
  }
}

function recordSyncItemResult(
  job: JobStateController,
  result: SyncItemResult,
  dryRun: boolean
): void {
  if (result.subjectId) {
    job.increment('withBangumiId')
  }

  switch (result.status) {
    case 'synced':
      job.increment('synced')
      return
    case 'wouldSync': {
      const preview = createFullSyncPreviewChange(result)
      if (preview) {
        job.addPreviewGroup(preview)
      }
      job.increment(dryRun ? 'wouldSync' : 'synced')
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
      label: '收藏状态',
      before: remote ? formatScopedCollectionType(result.scope, remote.type) : '未收藏',
      after: formatScopedCollectionType(result.scope, payload.type),
      tone: remote ? 'info' : 'success'
    })
  }

  const remoteScore = normalizeBangumiRate(remote?.rate)
  if (payload.rate !== undefined && (payload.rate !== 0 || remoteScore !== undefined)) {
    rows.push({
      label: '评分',
      before: remoteScore === undefined ? '未评分' : `${remoteScore}`,
      after: formatSyncPayloadRate(payload.rate),
      tone: payload.rate === 0 ? 'warning' : remote ? 'info' : 'success'
    })
  }

  if (rows.length === 0) {
    return undefined
  }

  return createPreviewGroup({
    title: item.name,
    subjectId,
    badge: {
      label: remote ? '更新 Bangumi 收藏' : '创建 Bangumi 收藏',
      tone: remote ? 'info' : 'success'
    },
    rows
  })
}

function createImportCollectionCreatePreviewChange({
  collection,
  fields,
  targetCollection,
  scope
}: {
  collection: BangumiUserCollection
  fields: BangumiImportCollectionsArgs['fields']
  targetCollection: LocalCollectionTarget | undefined
  scope: BangumiMediaScope
}): BangumiJobPreviewGroup {
  const subjectId = readCollectionSubjectId(collection)
  const subject = collection.subject
  const title = subject
    ? formatBangumiSubjectTitle(subject.name_cn, subject.name, subjectId)
    : `${subjectId}`
  const label = getMediaScopeLabel(scope)
  const rows: BangumiJobPreviewRow[] = [
    { label, before: '不存在', after: '创建', tone: 'success' },
    { label: 'Bangumi ID', before: '无', after: `${subjectId}`, tone: 'success' }
  ]

  if (fields.status) {
    rows.push({
      label: '状态',
      before: '未设置',
      after: formatLocalStatus(mapCollectionTypeToLocalStatus(collection.type)),
      tone: 'success'
    })
  }

  if (fields.score) {
    rows.push({
      label: '评分',
      before: '未评分',
      after: formatCollectionScore(collection.rate),
      tone: 'success'
    })
  }

  if (fields.tags) {
    rows.push({
      label: '标签',
      before: '无',
      after: formatCollectionTags(collection.tags),
      tone: 'success'
    })
  }

  if (targetCollection) {
    rows.push({
      label: '合集',
      before: '未加入',
      after: formatTargetCollectionValue(targetCollection),
      tone: 'success'
    })
  }

  return createPreviewGroup({
    title,
    subjectId,
    badge: { label: `创建本地${label}`, tone: 'success' },
    rows
  })
}

async function createImportCollectionPatchPreviewChange({
  adapter,
  item,
  collection,
  fields,
  targetCollection,
  scope
}: {
  adapter: LocalMediaAdapter
  item: LocalMediaItem
  collection: BangumiUserCollection
  fields: BangumiImportCollectionsArgs['fields']
  targetCollection: LocalCollectionTarget | undefined
  scope: BangumiMediaScope
}): Promise<BangumiJobPreviewGroup | undefined> {
  const subjectId = readCollectionSubjectId(collection)
  const plan = await buildCollectionLocalUpdatePlan({
    adapter,
    item,
    collection,
    fields,
    targetCollection
  })

  if (!hasCollectionLocalChanges(plan)) {
    return undefined
  }

  return createPreviewGroup({
    title: item.name,
    subjectId,
    badge: { label: `更新本地${getMediaScopeLabel(scope)}`, tone: 'info' },
    rows: plan.rows
  })
}

function createIndexCreatePreviewChange(
  subject: BangumiIndexSubject,
  targetCollection: LocalCollectionTarget | undefined,
  scope: BangumiMediaScope
): BangumiJobPreviewGroup {
  const subjectId = normalizePositiveInteger(subject.id) ?? subject.id
  const title = formatBangumiSubjectTitle(subject.name_cn, subject.name, subjectId)
  const label = getMediaScopeLabel(scope)
  const rows: BangumiJobPreviewRow[] = [
    { label, before: '不存在', after: '创建', tone: 'success' },
    { label: 'Bangumi ID', before: '无', after: `${subjectId}`, tone: 'success' }
  ]

  if (targetCollection) {
    rows.push({
      label: '合集',
      before: '未加入',
      after: formatTargetCollectionValue(targetCollection),
      tone: 'success'
    })
  }

  return createPreviewGroup({
    title,
    subjectId,
    badge: { label: `创建本地${label}`, tone: 'success' },
    rows
  })
}

async function createIndexCollectionPatchPreviewChange(
  adapter: LocalMediaAdapter,
  item: LocalMediaItem,
  subjectId: number,
  targetCollection: LocalCollectionTarget
): Promise<BangumiJobPreviewGroup | undefined> {
  const hasRelation =
    (await adapter.hasCollectionMembership?.(item.localId, targetCollection)) ?? false
  if (hasRelation) {
    return undefined
  }

  return createPreviewGroup({
    title: item.name,
    subjectId,
    badge: { label: '更新本地游戏', tone: 'info' },
    rows: [
      {
        label: '合集',
        before: '未加入',
        after: formatTargetCollectionValue(targetCollection),
        tone: 'success'
      }
    ]
  })
}

function recordRemoteOnlyImportPreview({
  job,
  scope,
  planItems,
  dryRun
}: {
  job: JobStateController
  scope: BangumiMediaScope
  planItems: readonly CollectionImportPlanItem[]
  dryRun: boolean
}): void {
  if (!dryRun) {
    job.increment('skippedUnsupportedScope', planItems.length || 1)
    job.report('completed', `${getMediaScopeLabel(scope)}暂不支持写入本地库。`, {
      current: planItems.length,
      total: planItems.length
    })
    return
  }

  for (const [index, planItem] of planItems.entries()) {
    const { collection, subjectId } = planItem
    if (!subjectId) {
      continue
    }
    job.report('buildingRemoteCollectionPreview', '正在生成远端收藏预览...', {
      current: index + 1,
      total: planItems.length
    })

    job.increment('remoteOnly')
    job.addPreviewGroup(
      createRemotePreviewGroup({
        scope,
        subjectId,
        title: collection.subject
          ? formatBangumiSubjectTitle(
              collection.subject.name_cn,
              collection.subject.name,
              subjectId
            )
          : `Bangumi ${subjectId}`,
        rows: [
          {
            label: '收藏状态',
            before: '远端',
            after: formatScopedCollectionType(scope, collection.type),
            tone: 'info'
          }
        ]
      })
    )
  }

  job.report('completed', `${getMediaScopeLabel(scope)}远端收藏预览完成。`, {
    current: planItems.length,
    total: planItems.length
  })
}

function recordRemoteOnlyIndexPreview({
  job,
  scope,
  planItems,
  dryRun
}: {
  job: JobStateController
  scope: BangumiMediaScope
  planItems: readonly IndexImportPlanItem[]
  dryRun: boolean
}): void {
  if (!dryRun) {
    job.increment('skippedUnsupportedScope', planItems.length || 1)
    job.report('completed', `${getMediaScopeLabel(scope)}暂不支持写入本地库。`, {
      current: planItems.length,
      total: planItems.length
    })
    return
  }

  for (const [index, planItem] of planItems.entries()) {
    const { action, subject, subjectId } = planItem
    if (action.kind === 'error') {
      job.addError(new BangumiExtensionError('bangumi_validation', action.message), {
        scope,
        subjectId: action.subjectId
      })
      job.increment('failedItems')
      continue
    }

    if (!subjectId) {
      continue
    }
    job.report('buildingRemoteIndexPreview', '正在生成远端目录预览...', {
      current: index + 1,
      total: planItems.length
    })

    job.increment('remoteOnly')
    job.addPreviewGroup(
      createRemotePreviewGroup({
        scope,
        subjectId,
        title: formatBangumiSubjectTitle(subject.name_cn, subject.name, subjectId),
        rows: [
          {
            label: getMediaScopeLabel(scope),
            before: '目录条目',
            after: '远端预览',
            tone: 'info'
          }
        ]
      })
    )
  }

  job.report('completed', `${getMediaScopeLabel(scope)}目录远端预览完成。`, {
    current: planItems.length,
    total: planItems.length
  })
}

function reportCollectionImportItemProgress({
  job,
  actionKind,
  dryRun,
  label,
  current,
  total
}: {
  job: JobStateController
  actionKind: CollectionImportPlanItem['action']['kind']
  dryRun: boolean
  label: string
  current: number
  total: number
}): void {
  if (dryRun) {
    job.report('planningCollectionImport', '正在生成收藏导入预览...', { current, total })
    return
  }

  if (actionKind === 'create') {
    job.report('creatingLocalItems', `正在添加${label}...`, { current, total })
    return
  }

  if (actionKind === 'patch') {
    job.report('patchingLocalItems', `正在更新${label}...`, { current, total })
    return
  }

  job.report('processingCollectionImport', `正在检查${label}...`, { current, total })
}

function reportIndexImportItemProgress({
  job,
  actionKind,
  dryRun,
  label,
  current,
  total
}: {
  job: JobStateController
  actionKind: IndexImportPlanItem['action']['kind']
  dryRun: boolean
  label: string
  current: number
  total: number
}): void {
  if (dryRun) {
    job.report('planningIndexImport', '正在生成目录导入预览...', { current, total })
    return
  }

  if (actionKind === 'patch') {
    job.report('patchingLocalItems', `正在更新${label}...`, { current, total })
    return
  }

  if (actionKind === 'skip') {
    job.report('processingIndexImport', `正在检查${label}...`, { current, total })
    return
  }

  job.report('creatingLocalItems', `正在添加${label}...`, { current, total })
}

async function resolveTargetCollection(
  adapter: LocalMediaAdapter,
  targetCollection: BangumiImportTargetCollection
): Promise<LocalCollectionTarget | undefined> {
  if (targetCollection.kind !== 'existing') {
    return undefined
  }

  return adapter.resolveExistingCollection?.(targetCollection.collectionId)
}

async function resolveIndexTargetCollection(
  adapter: LocalMediaAdapter,
  targetCollection: BangumiImportTargetCollection,
  indexTitle: string
): Promise<LocalCollectionTarget | undefined> {
  if (targetCollection.kind === 'byIndexTitle') {
    return adapter.resolveCollectionByTitle?.(indexTitle)
  }

  return resolveTargetCollection(adapter, targetCollection)
}

async function importItemFromCollection(
  executor: ImportExecutor,
  scope: BangumiMediaScope,
  profileId: string | undefined,
  collection: BangumiUserCollection
) {
  const subjectId = readCollectionSubjectId(collection)
  const subject = collection.subject
  const title = subject
    ? formatBangumiSubjectTitle(subject.name_cn, subject.name, subjectId)
    : `Bangumi ${subjectId}`

  return executor.addFromScraper(scope, {
    profileId: requireProfileId(profileId),
    name: title,
    knownIds: [{ source: BANGUMI_SOURCE_ID, id: String(subjectId) }]
  })
}

async function importItemFromIndexSubject(
  executor: ImportExecutor,
  scope: BangumiMediaScope,
  profileId: string | undefined,
  subject: BangumiIndexSubject
) {
  const subjectId = normalizePositiveInteger(subject.id)
  if (!subjectId) {
    throw new BangumiExtensionError('bangumi_validation', 'Bangumi 目录条目缺少有效 subject ID。')
  }

  return executor.addFromScraper(scope, {
    profileId: requireProfileId(profileId),
    name: formatBangumiSubjectTitle(subject.name_cn, subject.name, subjectId),
    knownIds: [{ source: BANGUMI_SOURCE_ID, id: String(subjectId) }]
  })
}

async function requireLocalItem(
  adapter: LocalMediaAdapter,
  localId: string
): Promise<LocalMediaItem> {
  const item = await adapter.getLocalItem(localId)
  if (!item) {
    throw new BangumiExtensionError('library_update_failed', '导入后的本地条目不存在。')
  }
  return item
}

async function applyCollectionLocalUpdate({
  adapter,
  executor,
  scope,
  item,
  collection,
  fields,
  targetCollection
}: {
  adapter: LocalMediaAdapter
  executor: ImportExecutor
  scope: BangumiMediaScope
  item: LocalMediaItem
  collection: BangumiUserCollection
  fields: BangumiImportCollectionsArgs['fields']
  targetCollection: LocalCollectionTarget | undefined
}): Promise<void> {
  const plan = await buildCollectionLocalUpdatePlan({
    adapter,
    item,
    collection,
    fields,
    targetCollection
  })

  if (Object.keys(plan.patch).length > 0) {
    await executor.patchUserFields(scope, item.localId, plan.patch)
  }

  for (const tagName of plan.tagNames) {
    await executor.ensureTag(scope, item.localId, tagName)
  }

  if (plan.targetCollection) {
    await executor.ensureInCollection(scope, item.localId, plan.targetCollection)
  }
}

async function buildCollectionLocalUpdatePlan({
  adapter,
  item,
  collection,
  fields,
  targetCollection
}: {
  adapter: LocalMediaAdapter
  item: LocalMediaItem
  collection: BangumiUserCollection
  fields: BangumiImportCollectionsArgs['fields']
  targetCollection: LocalCollectionTarget | undefined
}): Promise<CollectionLocalUpdatePlan> {
  const patch: LocalMediaUserPatch = {}
  const rows: BangumiJobPreviewRow[] = []
  let tagNames: readonly string[] = []
  let resolvedTargetCollection: LocalCollectionTarget | undefined

  if (fields.status) {
    const targetStatus = mapCollectionTypeToLocalStatus(collection.type)
    if (item.status !== targetStatus) {
      patch.status = targetStatus
      rows.push({
        label: '状态',
        before: formatLocalStatus(item.status),
        after: formatLocalStatus(targetStatus),
        tone: 'info'
      })
    }
  }

  if (fields.score) {
    const localScore = normalizeLocalScore(item.score)
    const targetScore = normalizeCollectionScoreForImport(collection.rate)
    if (localScore !== targetScore) {
      patch.score = targetScore
      rows.push({
        label: '评分',
        before: formatLocalScore(localScore),
        after: formatLocalScore(targetScore),
        tone: 'info'
      })
    }
  }

  if (fields.tags) {
    const targetTagNames = normalizeCollectionTagNames(collection.tags)
    const currentTagNames = (await adapter.listTagNames?.(item.localId)) ?? new Set<string>()
    const missingTags = targetTagNames.filter((tagName) => !currentTagNames.has(tagName))
    if (missingTags.length > 0) {
      tagNames = missingTags
      rows.push({
        label: '标签',
        before: formatTagNames([...currentTagNames]),
        after: formatTagNames(targetTagNames),
        tone: 'info'
      })
    }
  }

  const hasTargetCollectionRelation = targetCollection
    ? ((await adapter.hasCollectionMembership?.(item.localId, targetCollection)) ?? false)
    : false
  if (targetCollection && !hasTargetCollectionRelation) {
    resolvedTargetCollection = targetCollection
    rows.push({
      label: '合集',
      before: '未加入',
      after: formatTargetCollectionValue(targetCollection),
      tone: 'success'
    })
  }

  return {
    patch,
    tagNames,
    targetCollection: resolvedTargetCollection,
    rows
  }
}

function hasCollectionLocalChanges(plan: CollectionLocalUpdatePlan): boolean {
  return (
    Object.keys(plan.patch).length > 0 ||
    plan.tagNames.length > 0 ||
    plan.targetCollection !== undefined ||
    plan.rows.length > 0
  )
}

function readCollectionSubjectId(collection: BangumiUserCollection): number {
  return (
    normalizePositiveInteger(collection.subject_id) ??
    normalizePositiveInteger(collection.subject?.id) ??
    0
  )
}

function normalizePositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : undefined
}

function normalizeBangumiRate(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.min(10, Math.max(1, Math.trunc(value)))
    : undefined
}

function normalizeLocalScore(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeCollectionScoreForImport(value: unknown): number | null {
  const rate = normalizeBangumiRate(value)
  return rate === undefined ? null : rate * 10
}

function normalizeCollectionTagNames(tags: readonly string[] | undefined): readonly string[] {
  const names: string[] = []
  const seen = new Set<string>()

  for (const tag of tags ?? []) {
    const name = tag.trim()
    if (name && !seen.has(name)) {
      seen.add(name)
      names.push(name)
    }
  }

  return names
}

function mapCollectionTypeToLocalStatus(type: BangumiCollectionType): string {
  switch (type) {
    case 1:
      return 'notStarted'
    case 2:
      return 'completed'
    case 3:
      return 'inProgress'
    case 4:
    case 5:
      return 'shelved'
  }
}

function formatBangumiSubjectTitle(
  nameCn: string | undefined,
  name: string | undefined,
  fallback: string | number
): string {
  return nameCn?.trim() || name?.trim() || `Bangumi ${fallback}`
}

function createRemotePreviewGroup({
  scope,
  subjectId,
  title,
  rows
}: {
  scope: BangumiMediaScope
  subjectId: string | number
  title: string
  rows: readonly BangumiJobPreviewRow[]
}): BangumiJobPreviewGroup {
  return createPreviewGroup({
    title,
    subjectId,
    badge: { label: `${getMediaScopeLabel(scope)}远端预览`, tone: 'info' },
    rows
  })
}

function createPreviewGroup({
  title,
  subjectId,
  badge,
  rows
}: {
  title: string
  subjectId: string | number
  badge: BangumiJobPreviewGroup['badges'][number]
  rows: readonly BangumiJobPreviewRow[]
}): BangumiJobPreviewGroup {
  return {
    id: `${subjectId}:${badge.label}`,
    title,
    link: createSubjectLink(subjectId),
    badges: [badge],
    rows
  }
}

function createSubjectLink(subjectId: string | number): { label: string; href: string } {
  return {
    label: `#${subjectId}`,
    href: `https://bgm.tv/subject/${subjectId}`
  }
}

function formatTargetCollectionValue(targetCollection: LocalCollectionTarget): string {
  return targetCollection.name
}

function formatCollectionScore(score: number | undefined): string {
  return formatLocalScore(normalizeCollectionScoreForImport(score))
}

function formatSyncPayloadRate(rate: number): string {
  return rate === 0 ? '未评分' : `${rate}`
}

function formatLocalScore(score: number | null): string {
  return score === null ? '未评分' : (score / 10).toFixed(1)
}

function formatCollectionTags(tags: readonly string[] | undefined): string {
  const normalized = (tags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0)
  return normalized.length > 0 ? normalized.join('、') : '无'
}

function formatTagNames(tagNames: readonly string[]): string {
  return tagNames.length > 0 ? tagNames.join('、') : '无'
}

function formatLocalStatus(value: string | undefined): string {
  switch (value) {
    case 'notStarted':
      return '想玩'
    case 'inProgress':
      return '在玩'
    case 'partial':
      return '部分通关'
    case 'completed':
      return '玩过'
    case 'multiple':
      return '多周目'
    case 'shelved':
      return '搁置'
    default:
      return '未设置'
  }
}

function countEnabledFields(fields: { status: boolean; score: boolean; tags: boolean }): number {
  return Number(fields.status) + Number(fields.score) + Number(fields.tags)
}

function requireProfileId(profileId: string | undefined): string {
  const normalized = profileId?.trim()
  if (!normalized) {
    throw new BangumiExtensionError('profile_missing', '请选择用于创建游戏的刮削配置。')
  }
  return normalized
}

function assertNotCancelled(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new BangumiExtensionError('job_cancelled', 'Bangumi job 已取消。')
  }
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

function toUserErrorMessage(error: unknown): string {
  if (error instanceof BangumiExtensionError) {
    return error.message
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  return 'Bangumi job 执行失败。'
}

function toSafeErrorLog(error: unknown): Record<string, unknown> {
  if (error instanceof BangumiExtensionError) {
    return { code: error.code, message: error.message }
  }

  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }

  return { message: String(error) }
}
