import { isCancellationError } from '@kisaki3/extension-sdk'
import { CollectionReader } from '../../import/collection-reader'
import { m } from '../../i18n'
import { ImportExecutor } from '../../import/executor'
import { IndexReader } from '../../import/index-reader'
import { ImportPlanner } from '../../import/planner'
import type { BangumiMediaScope } from '../../../shared/scopes'
import type { LocalMediaAdapter } from '../../media/types'
import { BangumiExtensionError } from '../../utils/errors'
import { readPositiveInteger } from '../../utils/numbers'
import { omitUndefined } from '../../utils/object'
import { createImportSuppressTtlMs } from '../../sync/suppressor'
import type { BangumiImportCollectionsArgs, BangumiImportIndexArgs } from '../args'
import {
  JobStateController,
  runBangumiJob,
  type BangumiJobRun,
  type JobRunnerDependencies
} from '../context'
import {
  applyCollectionLocalUpdate,
  applyCollectionLocalUpdatePlan,
  buildCollectionLocalUpdatePlan,
  hasCollectionLocalChanges,
  importItemFromCollection,
  importItemFromIndexSubject,
  readCollectionSubjectId,
  requireLocalItem,
  resolveIndexTargetCollection,
  resolveTargetCollection
} from './local'
import type { CollectedCollectionImport, CollectedIndexImport } from './model'
import {
  collectCollectionImportOperations,
  collectIndexImportOperations,
  emptyCollectedCollectionImport,
  emptyCollectedIndexImport
} from './planning'
import {
  incrementSkippedNoChange,
  recordSkippedCollectionImportPlanItems,
  recordSkippedIndexImportPlanItems,
  recordUnsupportedImportResult,
  reportCollectionImportExecutionProgress,
  reportCollectionImportExecutionStart,
  reportIndexImportExecutionProgress,
  reportIndexImportExecutionStart
} from './progress'
import {
  createIndexCollectionPatchPreviewChange,
  previewCollectionImport,
  previewIndexImport,
  recordRemoteOnlyCollectionPreview,
  recordRemoteOnlyIndexPreview
} from './preview'
import type { BangumiJobSummary } from '../summary'

export class ImportJobRunner {
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

  runImportCollections(
    args: BangumiImportCollectionsArgs,
    context: BangumiJobRun
  ): Promise<BangumiJobSummary> {
    return runBangumiJob(context, this.deps.logger, async (job) => {
      const collected = await this.collectCollectionImport(args, job, { requireWritable: true })
      if (!collected.adapter?.supportsImportWrite) {
        recordUnsupportedImportResult(job, args.scope)
        return
      }

      recordSkippedCollectionImportPlanItems(job, collected.planItems)
      incrementSkippedNoChange(job, collected.skippedNoChange)
      await this.executeCollectionImport(args, job, collected)

      const message = m().jobs.import.collectionsCompleted({
        added: job.counters.imported ?? 0,
        updated: job.counters.patchedExisting ?? 0,
        scope: collected.scope
      })
      job.report('completed', message, {
        current: job.counters.processed ?? 0,
        total: collected.operations.length
      })
    })
  }

  previewImportCollections(
    args: BangumiImportCollectionsArgs,
    context: BangumiJobRun
  ): Promise<BangumiJobSummary> {
    return runBangumiJob(context, this.deps.logger, async (job) => {
      const collected = await this.collectCollectionImport(args, job, { requireWritable: false })
      if (!collected.adapter?.supportsImportWrite) {
        recordRemoteOnlyCollectionPreview(job, args.scope, collected.planItems)
        return
      }

      recordSkippedCollectionImportPlanItems(job, collected.planItems)
      incrementSkippedNoChange(job, collected.skippedNoChange)
      previewCollectionImport(args, job, collected)

      const message = m().jobs.import.collectionsPreviewCompleted({
        toImport: job.counters.wouldImport ?? 0,
        toPatch: job.counters.wouldPatch ?? 0,
        scope: collected.scope
      })
      job.report('completed', message, {
        current: collected.operations.length,
        total: collected.operations.length
      })
    })
  }

  runImportIndex(args: BangumiImportIndexArgs, context: BangumiJobRun): Promise<BangumiJobSummary> {
    return runBangumiJob(context, this.deps.logger, async (job) => {
      const collected = await this.collectIndexImport(args, job, { requireWritable: true })
      if (!collected.adapter?.supportsImportWrite) {
        recordUnsupportedImportResult(job, args.scope)
        return
      }

      recordSkippedIndexImportPlanItems(job, collected.planItems)
      incrementSkippedNoChange(job, collected.skippedNoChange)
      await this.executeIndexImport(args, job, collected)

      const message = m().jobs.import.indexCompleted({
        added: job.counters.imported ?? 0,
        updated: job.counters.patchedExisting ?? 0,
        scope: collected.scope
      })
      job.report('completed', message, {
        current: job.counters.processed ?? 0,
        total: collected.operations.length
      })
    })
  }

  previewImportIndex(
    args: BangumiImportIndexArgs,
    context: BangumiJobRun
  ): Promise<BangumiJobSummary> {
    return runBangumiJob(context, this.deps.logger, async (job) => {
      const collected = await this.collectIndexImport(args, job, { requireWritable: false })
      if (!collected.adapter?.supportsImportWrite) {
        recordRemoteOnlyIndexPreview(job, args.scope, collected.planItems)
        return
      }

      recordSkippedIndexImportPlanItems(job, collected.planItems)
      incrementSkippedNoChange(job, collected.skippedNoChange)
      previewIndexImport(args, job, collected)

      const message = m().jobs.import.indexPreviewCompleted({
        toImport: job.counters.wouldImport ?? 0,
        toPatch: job.counters.wouldPatch ?? 0,
        scope: collected.scope
      })
      job.report('completed', message, {
        current: collected.operations.length,
        total: collected.operations.length
      })
    })
  }

  private async collectCollectionImport(
    args: BangumiImportCollectionsArgs,
    job: JobStateController,
    options: { requireWritable: boolean }
  ): Promise<CollectedCollectionImport> {
    const descriptor = this.deps.mediaRegistry.require(args.scope)
    const localAdapter = this.importExecutor.getLocalAdapter(args.scope)
    job.report('validating', m().jobs.import.validating, { indeterminate: true })

    if (options.requireWritable && !localAdapter?.supportsImportWrite) {
      return emptyCollectedCollectionImport(descriptor.scope)
    }

    const account = await this.requireAccount()
    const adapter = localAdapter?.supportsImportWrite
      ? options.requireWritable
        ? this.importExecutor.requireWritableAdapter(args.scope)
        : localAdapter
      : undefined

    if (adapter && options.requireWritable) {
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
      event: job,
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
      return omitUndefined({
        scope: descriptor.scope,
        targetCollection,
        planItems: plan.items,
        operations: [],
        skippedNoChange: 0
      })
    }

    job.report('matchingLocalItems', m().jobs.import.matchingLocal({ scope: descriptor.scope }), {
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
    const collected = await collectCollectionImportOperations({
      adapter,
      args,
      job,
      planItems: plan.items,
      targetCollection
    })

    return omitUndefined({
      scope: descriptor.scope,
      adapter,
      targetCollection,
      planItems: plan.items,
      operations: collected.operations,
      skippedNoChange: collected.skippedNoChange
    })
  }

  private async collectIndexImport(
    args: BangumiImportIndexArgs,
    job: JobStateController,
    options: { requireWritable: boolean }
  ): Promise<CollectedIndexImport> {
    const descriptor = this.deps.mediaRegistry.require(args.scope)
    const localAdapter = this.importExecutor.getLocalAdapter(args.scope)
    job.report('validating', m().jobs.import.validatingIndex, { indeterminate: true })

    if (options.requireWritable && !localAdapter?.supportsImportWrite) {
      return emptyCollectedIndexImport(descriptor.scope)
    }

    const adapter = localAdapter?.supportsImportWrite
      ? options.requireWritable
        ? this.importExecutor.requireWritableAdapter(args.scope)
        : localAdapter
      : undefined

    if (adapter && options.requireWritable) {
      await this.requireWritableProfile(adapter, args.profileId)
    }

    job.increment('indices')
    job.increment('patchExisting', args.patchExisting ? 1 : 0)
    const index = await this.indexReader.readIndex(args.indexId, job)
    const targetCollection = adapter
      ? await resolveIndexTargetCollection(adapter, args.targetCollection, index.title)
      : undefined
    job.increment('selectedTargetCollections', targetCollection ? 1 : 0)

    const subjects = await this.indexReader.readIndexSubjects({
      indexId: args.indexId,
      scope: args.scope,
      event: job,
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
      return omitUndefined({
        scope: descriptor.scope,
        targetCollection,
        planItems: plan.items,
        operations: [],
        skippedNoChange: 0
      })
    }

    job.report('matchingLocalItems', m().jobs.import.matchingLocal({ scope: descriptor.scope }), {
      current: 0,
      total: subjects.length
    })
    const subjectIds = subjects
      .map((subject) => readPositiveInteger(subject.id))
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
    const collected = await collectIndexImportOperations({
      adapter,
      args,
      job,
      planItems: plan.items,
      targetCollection
    })

    return omitUndefined({
      scope: descriptor.scope,
      adapter,
      targetCollection,
      planItems: plan.items,
      operations: collected.operations,
      skippedNoChange: collected.skippedNoChange
    })
  }

  private async executeCollectionImport(
    args: BangumiImportCollectionsArgs,
    job: JobStateController,
    collected: CollectedCollectionImport
  ): Promise<void> {
    const adapter = requireCollectedAdapter(collected.adapter)
    reportCollectionImportExecutionStart(job, collected.scope, collected.operations.length)

    for (const operation of collected.operations) {
      await job.checkpoint()
      const { item: planItem } = operation
      const { collection, subjectId: subjectIdText } = planItem
      let countProcessed = true

      try {
        if (operation.kind === 'patch') {
          await this.suppressImport(args.scope, operation.localItem.localId)
          await applyCollectionLocalUpdatePlan({
            executor: this.importExecutor,
            scope: args.scope,
            item: operation.localItem,
            plan: operation.updatePlan
          })
          job.increment('patchedExisting')
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
            targetCollection: collected.targetCollection
          })
          job.increment('imported')
        } else if (args.patchExisting) {
          const updatePlan = await buildCollectionLocalUpdatePlan({
            adapter,
            item,
            collection,
            fields: args.fields,
            targetCollection: collected.targetCollection
          })
          if (!hasCollectionLocalChanges(updatePlan)) {
            job.increment('skippedNoChange')
            continue
          }

          await applyCollectionLocalUpdatePlan({
            executor: this.importExecutor,
            scope: args.scope,
            item,
            plan: updatePlan
          })
          job.increment('patchedExisting')
        } else {
          job.increment('skippedExistingLocalItem')
        }
      } catch (error) {
        if (isCancellationError(error) || job.signal.aborted) {
          countProcessed = false
          throw error
        }
        job.addError(error, { scope: args.scope, subjectId: subjectIdText })
        job.increment('failedItems')
      } finally {
        if (countProcessed) {
          job.increment('processed')
          reportCollectionImportExecutionProgress({
            job,
            actionKind: operation.kind,
            scope: collected.scope,
            current: job.counters.processed ?? 0,
            total: collected.operations.length
          })
        }
      }
    }
  }

  private async executeIndexImport(
    args: BangumiImportIndexArgs,
    job: JobStateController,
    collected: CollectedIndexImport
  ): Promise<void> {
    const adapter = requireCollectedAdapter(collected.adapter)
    reportIndexImportExecutionStart(job, collected.scope, collected.operations.length)

    for (const operation of collected.operations) {
      await job.checkpoint()
      const { item: planItem } = operation
      const { subject, subjectId: subjectIdText } = planItem
      const subjectId = Number(subjectIdText)
      let countProcessed = true

      try {
        if (operation.kind === 'patch') {
          await this.suppressImport(args.scope, operation.localItem.localId)
          await this.importExecutor.ensureInCollection(
            args.scope,
            operation.localItem.localId,
            operation.targetCollection
          )
          job.increment('patchedExisting')
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
        if (collected.targetCollection && imported.isNew) {
          await this.importExecutor.ensureInCollection(
            args.scope,
            item.localId,
            collected.targetCollection
          )
        }

        if (imported.isNew) {
          job.increment('imported')
        } else if (args.patchExisting && collected.targetCollection) {
          const change = await createIndexCollectionPatchPreviewChange(
            adapter,
            item,
            subjectId,
            collected.targetCollection
          )
          if (!change) {
            job.increment('skippedNoChange')
            continue
          }

          await this.importExecutor.ensureInCollection(
            args.scope,
            item.localId,
            collected.targetCollection
          )
          job.increment('patchedExisting')
        } else {
          job.increment('skippedExistingLocalItem')
        }
      } catch (error) {
        if (isCancellationError(error) || job.signal.aborted) {
          countProcessed = false
          throw error
        }
        job.addError(error, { scope: args.scope, subjectId: subjectIdText })
        job.increment('failedItems')
      } finally {
        if (countProcessed) {
          job.increment('processed')
          reportIndexImportExecutionProgress({
            job,
            actionKind: operation.kind,
            scope: collected.scope,
            current: job.counters.processed ?? 0,
            total: collected.operations.length
          })
        }
      }
    }
  }

  private async requireWritableProfile(
    adapter: LocalMediaAdapter,
    profileId: string | undefined
  ): Promise<void> {
    const normalizedProfileId = profileId?.trim()
    if (!normalizedProfileId) {
      throw new BangumiExtensionError('profile_missing', m().errors.profileRequired)
    }

    const profiles = (await adapter.listProfiles?.()) ?? []
    if (!profiles.some((profile) => profile.id === normalizedProfileId)) {
      throw new BangumiExtensionError('profile_missing', m().errors.profileNotFound)
    }
  }

  private async suppressImport(scope: BangumiMediaScope, localId: string): Promise<void> {
    const settings = await this.deps.settingsStore.get()
    this.deps.syncSuppressor.suppressImport(
      scope,
      localId,
      createImportSuppressTtlMs(settings.autoSync.debounceMs)
    )
  }

  private async requireAccount() {
    const account = await this.deps.accountService.getAccountSnapshot()
    if (!account) {
      throw new BangumiExtensionError('auth_required', m().errors.authRequired)
    }
    return account
  }
}

function requireCollectedAdapter(adapter: LocalMediaAdapter | undefined): LocalMediaAdapter {
  if (!adapter?.supportsImportWrite) {
    throw new BangumiExtensionError(
      'local_media_unsupported',
      m().errors.localWriteUnsupportedGeneric
    )
  }

  return adapter
}

function countEnabledFields(fields: {
  status: boolean
  score: boolean
  tags: boolean
  unitProgress: boolean
}): number {
  return (
    Number(fields.status) + Number(fields.score) + Number(fields.tags) + Number(fields.unitProgress)
  )
}
