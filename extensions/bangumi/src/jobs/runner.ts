import type {
  BangumiAuthRefreshArgs,
  BangumiChangedItemsSyncArgs,
  BangumiFullSyncArgs,
  BangumiImportCollectionsArgs,
  BangumiImportIndexArgs
} from './args'
import { AuthJobRunner } from './auth'
import type { BangumiJobRun, JobRunnerDependencies } from './context'
import { ImportJobRunner } from './import/runner'
import { SyncJobRunner } from './sync'
import type { BangumiJobSummary } from './summary'

export type { BangumiJobHandle, BangumiJobRun, JobRunnerDependencies } from './context'

export class JobRunner {
  private readonly auth: AuthJobRunner
  private readonly sync: SyncJobRunner
  private readonly imports: ImportJobRunner

  constructor(deps: JobRunnerDependencies) {
    this.auth = new AuthJobRunner(deps)
    this.sync = new SyncJobRunner(deps)
    this.imports = new ImportJobRunner(deps)
  }

  runAuthRefresh(
    args: BangumiAuthRefreshArgs,
    context: BangumiJobRun
  ): Promise<BangumiJobSummary> {
    return this.auth.runAuthRefresh(args, context)
  }

  runChangedItemsSync(
    args: BangumiChangedItemsSyncArgs,
    context: BangumiJobRun
  ): Promise<BangumiJobSummary> {
    return this.sync.runChangedItemsSync(args, context)
  }

  runFullSync(args: BangumiFullSyncArgs, context: BangumiJobRun): Promise<BangumiJobSummary> {
    return this.sync.runFullSync(args, context)
  }

  previewFullSync(
    args: BangumiFullSyncArgs,
    context: BangumiJobRun
  ): Promise<BangumiJobSummary> {
    return this.sync.previewFullSync(args, context)
  }

  runImportCollections(
    args: BangumiImportCollectionsArgs,
    context: BangumiJobRun
  ): Promise<BangumiJobSummary> {
    return this.imports.runImportCollections(args, context)
  }

  previewImportCollections(
    args: BangumiImportCollectionsArgs,
    context: BangumiJobRun
  ): Promise<BangumiJobSummary> {
    return this.imports.previewImportCollections(args, context)
  }

  runImportIndex(
    args: BangumiImportIndexArgs,
    context: BangumiJobRun
  ): Promise<BangumiJobSummary> {
    return this.imports.runImportIndex(args, context)
  }

  previewImportIndex(
    args: BangumiImportIndexArgs,
    context: BangumiJobRun
  ): Promise<BangumiJobSummary> {
    return this.imports.previewImportIndex(args, context)
  }
}
