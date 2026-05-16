import { createLogger } from '@main/log'
import type { BackgroundTaskRunner } from './runner'
import type { BackgroundTaskStore } from './store'

const log = createLogger('BackgroundTask')

const MAX_TIMEOUT_MS = 2_147_483_647

export interface BackgroundTaskSchedulerOptions {
  store: BackgroundTaskStore
  runner: BackgroundTaskRunner
}

export class BackgroundTaskScheduler {
  private readonly timers = new Map<string, NodeJS.Timeout>()

  constructor(private readonly options: BackgroundTaskSchedulerOptions) {}

  refreshAll(): void {
    this.dispose()
    for (const taskId of this.options.store.listTaskIds()) {
      this.refresh(taskId)
    }
  }

  refresh(taskId: string): void {
    this.clear(taskId)
    const task = this.options.store.getScheduledTask(taskId)
    if (!task?.nextRunAt) {
      return
    }

    const delayMs = Math.max(0, Math.min(task.nextRunAt - Date.now(), MAX_TIMEOUT_MS))
    const timer = setTimeout(() => {
      void this.options.runner.runScheduled(taskId).catch((error) => {
        log.error('Scheduled task failed.', error, { taskId: taskId })
      })
    }, delayMs)
    this.timers.set(taskId, timer)
  }

  clear(taskId: string): void {
    const timer = this.timers.get(taskId)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(taskId)
    }
  }

  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
  }
}
