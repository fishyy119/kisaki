import type { TaskRunProgressUpdate } from '@shared/task-run'
import type { TaskRunManager } from './manager'

export class TaskRunCancellation extends Error {
  override readonly name = 'TaskRunCancellation'

  constructor(message = 'Task run was cancelled.') {
    super(message)
  }
}

export function isTaskRunCancellation(error: unknown): error is TaskRunCancellation {
  return error instanceof TaskRunCancellation
}

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
