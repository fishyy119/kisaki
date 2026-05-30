import type {
  AutomationCommandInvocationStatus,
  AutomationFailurePolicy,
  AutomationRunHistoryRecord,
  AutomationTriggers
} from '@shared/automation'
import type { BadgeVariants } from '@renderer/components/ui/badge'

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
})

const FULL_DATE_TIME_FORMAT = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
})

export function formatAutomationTriggers(triggers: AutomationTriggers): string {
  const labels: string[] = []

  if (triggers.onStartup) {
    labels.push('启动时')
  }

  if (triggers.cron) {
    labels.push(`Cron ${triggers.cron.expression}`)
  }

  return labels.length > 0 ? labels.join('，') : '手动运行'
}

export function formatCronTimezone(triggers: AutomationTriggers): string {
  return triggers.cron?.timezone ?? '系统时区'
}

export function formatFailurePolicy(policy: AutomationFailurePolicy): string {
  switch (policy.type) {
    case 'none':
      return '不重试'
    case 'retry':
      return `重试 ${policy.retryCount} 次`
    case 'pauseAutomation':
      return `失败后暂停${policy.retryCount ? `，先重试 ${policy.retryCount} 次` : ''}`
  }
}

export function formatAutomationTimestamp(value: number | undefined, fallback = '从未'): string {
  if (!value) {
    return fallback
  }

  return DATE_TIME_FORMAT.format(new Date(value))
}

export function formatFullTimestamp(value: number | undefined, fallback = '从未'): string {
  if (!value) {
    return fallback
  }

  return FULL_DATE_TIME_FORMAT.format(new Date(value))
}

export function formatRunDuration(record: AutomationRunHistoryRecord): string {
  return formatDuration(record.finishedAt - record.startedAt)
}

export function formatDuration(durationMs: number): string {
  const safeDuration = Math.max(0, durationMs)
  if (safeDuration < 1_000) {
    return `${safeDuration}ms`
  }

  if (safeDuration < 60_000) {
    return `${(safeDuration / 1_000).toFixed(1)}s`
  }

  const minutes = Math.floor(safeDuration / 60_000)
  const seconds = Math.floor((safeDuration % 60_000) / 1_000)
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
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
  switch (status) {
    case 'completed':
      return '完成'
    case 'failed':
      return '失败'
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
  switch (trigger) {
    case 'manual':
      return '手动'
    case 'startup':
      return '启动'
    case 'cron':
      return 'Cron'
  }
}
