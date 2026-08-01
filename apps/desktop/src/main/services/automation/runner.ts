import { randomUUID } from 'node:crypto'
import type { CommandService } from '@main/services/command'
import type {
  Automation,
  AutomationFailurePolicy,
  AutomationRunHistoryRecord,
  AutomationRunStartedEvent,
  AutomationTrigger
} from '@shared/automation'
import type { AutomationStore } from './store'

const DEFAULT_RETRY_DELAY_MS = 5_000

export interface AutomationRunnerOptions {
  command: CommandService
  store: AutomationStore
  clearAutomationTimer(automationId: string): void
  refreshAutomationTimer(automationId: string): void
  onRunStarted(event: AutomationRunStartedEvent): void
  onRunFinished(record: AutomationRunHistoryRecord): void
}

export class AutomationRunner {
  private readonly runningAutomations = new Map<string, { controller: AbortController }>()

  constructor(private readonly options: AutomationRunnerOptions) {}

  runNow(automationId: string): Promise<AutomationRunHistoryRecord | null> {
    return this.runAutomation(automationId, 'manual')
  }

  runStartup(automationId: string): Promise<AutomationRunHistoryRecord | null> {
    return this.runAutomation(automationId, 'startup')
  }

  listRunningAutomationIds(): string[] {
    return [...this.runningAutomations.keys()]
  }

  runCron(automationId: string): Promise<AutomationRunHistoryRecord | null> {
    return this.runAutomation(automationId, 'cron')
  }

  cancel(automationId: string): boolean {
    const running = this.runningAutomations.get(automationId)
    if (!running) {
      return false
    }

    running.controller.abort()
    return true
  }

  dispose(): void {
    for (const running of this.runningAutomations.values()) {
      running.controller.abort()
    }
    this.runningAutomations.clear()
  }

  private async runAutomation(
    automationId: string,
    trigger: AutomationTrigger
  ): Promise<AutomationRunHistoryRecord | null> {
    const automation = this.options.store.require(automationId)
    if (this.runningAutomations.has(automationId)) {
      if (trigger === 'manual') {
        throw new Error('Automation is already running.')
      }
      return null
    }

    if (!automation.enabled && trigger !== 'manual') {
      return null
    }

    const controller = new AbortController()
    this.runningAutomations.set(automationId, { controller })
    this.options.clearAutomationTimer(automationId)
    this.options.onRunStarted({
      automationId: automation.id,
      commandId: automation.commandId,
      trigger,
      startedAt: Date.now()
    })

    try {
      const attempts = getAttemptCount(automation.failurePolicy)
      let lastRecord: AutomationRunHistoryRecord | null = null

      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        if (controller.signal.aborted) {
          break
        }

        const record = await this.invokeCommand(automation, trigger, attempt)
        await this.options.store.recordRun(record)
        this.options.onRunFinished(record)
        lastRecord = record

        if (record.invocationStatus === 'completed') {
          break
        }

        if (attempt < attempts) {
          const delayFinished = await delay(
            getRetryDelay(automation.failurePolicy),
            controller.signal
          )
          if (!delayFinished) {
            break
          }
        }
      }

      if (
        lastRecord?.invocationStatus === 'failed' &&
        automation.failurePolicy.type === 'pauseAutomation'
      ) {
        this.options.store.pauseAfterFailure(automationId)
      }

      return lastRecord
    } finally {
      this.runningAutomations.delete(automationId)
      this.options.refreshAutomationTimer(automationId)
    }
  }

  private async invokeCommand(
    automation: Automation,
    trigger: AutomationTrigger,
    attempt: number
  ): Promise<AutomationRunHistoryRecord> {
    const startedAt = Date.now()
    const commandTitleSnapshot =
      this.options.command.registry.get(automation.commandId)?.title ?? undefined

    try {
      await this.options.command.invoke({
        commandId: automation.commandId,
        args: automation.args,
        source: {
          type: 'automation',
          automation: {
            id: automation.id,
            nameSnapshot: automation.name,
            trigger,
            attempt
          }
        }
      })

      return createRecord({
        automation,
        trigger,
        attempt,
        commandTitleSnapshot,
        startedAt,
        invocationStatus: 'completed'
      })
    } catch (error) {
      return createRecord({
        automation,
        trigger,
        attempt,
        commandTitleSnapshot,
        startedAt,
        invocationStatus: 'failed',
        error
      })
    }
  }
}

function createRecord(input: {
  automation: Automation
  trigger: AutomationTrigger
  attempt: number
  commandTitleSnapshot?: string
  startedAt: number
  invocationStatus: AutomationRunHistoryRecord['invocationStatus']
  error?: unknown
}): AutomationRunHistoryRecord {
  return {
    id: randomUUID(),
    automationId: input.automation.id,
    automationNameSnapshot: input.automation.name,
    owner: input.automation.owner,
    trigger: input.trigger,
    attempt: input.attempt,
    commandId: input.automation.commandId,
    commandTitleSnapshot: input.commandTitleSnapshot,
    startedAt: input.startedAt,
    finishedAt: Date.now(),
    invocationStatus: input.invocationStatus,
    error: input.error === undefined ? undefined : { message: toErrorMessage(input.error) }
  }
}

function getAttemptCount(policy: AutomationFailurePolicy): number {
  if (policy.type === 'none') {
    return 1
  }
  return Math.max(1, (policy.retryCount ?? 0) + 1)
}

function getRetryDelay(policy: AutomationFailurePolicy): number {
  if (policy.type === 'none') {
    return 0
  }
  return Math.max(0, policy.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS)
}

function delay(ms: number, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) {
    return Promise.resolve(false)
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup()
      resolve(true)
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      cleanup()
      resolve(false)
    }
    const cleanup = () => signal?.removeEventListener('abort', onAbort)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
