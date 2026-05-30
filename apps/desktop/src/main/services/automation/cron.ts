import { CronExpressionParser } from 'cron-parser'
import type { AutomationCronTrigger } from '@shared/automation'

export function assertValidCronTrigger(trigger: AutomationCronTrigger): void {
  parseCronTrigger(trigger, Date.now()).next()
}

export function computeNextCronRunAt(
  trigger: AutomationCronTrigger,
  from: number
): number | undefined {
  try {
    return parseCronTrigger(trigger, from).next().getTime()
  } catch {
    return undefined
  }
}

function parseCronTrigger(trigger: AutomationCronTrigger, from: number) {
  const expression = trigger.expression.trim()
  if (!expression) {
    throw new Error('Cron expression is required.')
  }

  return CronExpressionParser.parse(expression, {
    currentDate: new Date(from),
    tz: normalizeTimezone(trigger.timezone)
  })
}

function normalizeTimezone(timezone: string | undefined): string | undefined {
  const normalized = timezone?.trim()
  return normalized ? normalized : undefined
}
