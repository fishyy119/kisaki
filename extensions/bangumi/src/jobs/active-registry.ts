export type BangumiActiveJobScope =
  | 'account.refresh'
  | 'sync.changedGames'
  | 'sync.full'
  | 'import.myCollections'
  | 'import.index'

export interface BangumiActiveJob {
  scope: BangumiActiveJobScope
  commandId: string
  executionId: string
  startedAt: number
  cancelable: boolean
  argsSummary?: string
}

export class ActiveJobRegistry {
  private readonly jobs = new Map<BangumiActiveJobScope, BangumiActiveJob>()

  get(scope: BangumiActiveJobScope): BangumiActiveJob | undefined {
    return this.jobs.get(scope)
  }

  set(job: BangumiActiveJob): void {
    this.jobs.set(job.scope, {
      scope: job.scope,
      commandId: job.commandId,
      executionId: job.executionId,
      startedAt: job.startedAt,
      cancelable: job.cancelable,
      ...(job.argsSummary ? { argsSummary: job.argsSummary } : {})
    })
  }

  delete(scope: BangumiActiveJobScope): void {
    this.jobs.delete(scope)
  }

  deleteExecution(scope: BangumiActiveJobScope, executionId: string): void {
    if (this.jobs.get(scope)?.executionId === executionId) {
      this.jobs.delete(scope)
    }
  }

  clear(): void {
    this.jobs.clear()
  }
}
