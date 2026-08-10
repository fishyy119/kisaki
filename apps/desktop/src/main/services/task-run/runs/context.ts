import type { TaskRunProgressUpdate } from '@shared/task-run'
import { TaskRunCancellation } from './cancellation'
import type { TaskRunManager } from './manager'

export interface TaskRunContext {
  readonly runId: string
  readonly signal: AbortSignal
  report(update: TaskRunProgressUpdate): void
  checkpoint(): Promise<void>
  throwIfCancelled(): void
}

export class DefaultTaskRunContext implements TaskRunContext {
  constructor(
    readonly runId: string,
    readonly signal: AbortSignal,
    private readonly manager: TaskRunManager
  ) {}

  report(update: TaskRunProgressUpdate): void {
    this.manager.report(this.runId, update)
  }

  async checkpoint(): Promise<void> {
    await this.manager.checkpoint(this.runId)
  }

  throwIfCancelled(): void {
    if (this.signal.aborted) {
      throw new TaskRunCancellation()
    }
  }
}
