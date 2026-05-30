import { createLogger } from '@main/log'
import type { AutomationRunner } from './runner'
import type { AutomationStore } from './store'

const log = createLogger('Automation')

const MAX_TIMEOUT_MS = 2_147_483_647

export interface AutomationSchedulerOptions {
  store: AutomationStore
  runner: AutomationRunner
}

export class AutomationScheduler {
  private readonly timers = new Map<string, NodeJS.Timeout>()

  constructor(private readonly options: AutomationSchedulerOptions) {}

  refreshAll(): void {
    this.dispose()
    for (const automationId of this.options.store.listAutomationIds()) {
      this.refresh(automationId)
    }
  }

  refresh(automationId: string): void {
    this.clear(automationId)
    const automation = this.options.store.getScheduledAutomation(automationId)
    if (!automation?.nextRunAt) {
      return
    }

    const delayMs = Math.max(0, Math.min(automation.nextRunAt - Date.now(), MAX_TIMEOUT_MS))
    const timer = setTimeout(() => {
      void this.options.runner.runCron(automationId).catch((error) => {
        log.error('Cron automation failed.', error, { automationId })
      })
    }, delayMs)
    this.timers.set(automationId, timer)
  }

  clear(automationId: string): void {
    const timer = this.timers.get(automationId)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(automationId)
    }
  }

  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
  }
}
