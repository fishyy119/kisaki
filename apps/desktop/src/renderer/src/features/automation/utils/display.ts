import type {
  AutomationCommandInvocationStatus,
  AutomationFailurePolicy,
  AutomationRunHistoryRecord,
  AutomationTriggers
} from '@shared/automation'
import type { BadgeVariants } from '@renderer/components/ui/badge'
import { formatters, messages } from '@renderer/core/i18n'

export function formatAutomationTriggers(triggers: AutomationTriggers): string {
  const display = messages.value.automation.display
  const labels: string[] = []

  if (triggers.onStartup) {
    labels.push(display.onStartup)
  }

  if (triggers.cron) {
    labels.push(`Cron ${triggers.cron.expression}`)
  }

  return labels.length > 0 ? labels.join(display.triggerSeparator) : display.manualOnly
}

export function formatCronTimezone(triggers: AutomationTriggers): string {
  return triggers.cron?.timezone ?? messages.value.automation.display.systemTimezone
}

export function formatFailurePolicy(policy: AutomationFailurePolicy): string {
  const display = messages.value.automation.display
  switch (policy.type) {
    case 'none':
      return display.noRetry
    case 'retry':
      return display.retryTimes({ count: policy.retryCount })
    case 'pauseAutomation':
      return policy.retryCount
        ? display.pauseAfterFailureWithRetry({ count: policy.retryCount })
        : display.pauseAfterFailure
  }
}

export function formatAutomationTimestamp(value: number | undefined, fallback?: string): string {
  if (!value) {
    return fallback ?? messages.value.automation.display.never
  }

  return formatters.value.dateTime(new Date(value))
}

export function formatFullTimestamp(value: number | undefined, fallback?: string): string {
  if (!value) {
    return fallback ?? messages.value.automation.display.never
  }

  return formatters.value.dateTime(new Date(value))
}

export function formatRunDuration(record: AutomationRunHistoryRecord): string {
  return formatDuration(record.finishedAt - record.startedAt)
}

export function formatDuration(durationMs: number): string {
  return formatters.value.durationFine(durationMs)
}

export function formatJson(value: unknown): string {
  if (value === undefined) {
    return ''
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function getRunStatusLabel(status: AutomationCommandInvocationStatus): string {
  const display = messages.value.automation.display
  switch (status) {
    case 'completed':
      return display.statusCompleted
    case 'failed':
      return display.statusFailed
  }
}

export function getRunStatusVariant(
  status: AutomationCommandInvocationStatus
): BadgeVariants['variant'] {
  switch (status) {
    case 'completed':
      return 'success'
    case 'failed':
      return 'destructive'
  }
}

export function getTriggerLabel(trigger: AutomationRunHistoryRecord['trigger']): string {
  const display = messages.value.automation.display
  switch (trigger) {
    case 'manual':
      return display.triggerManual
    case 'startup':
      return display.triggerStartup
    case 'cron':
      return 'Cron'
  }
}
