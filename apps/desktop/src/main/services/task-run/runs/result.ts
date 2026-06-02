import type { TaskRunFinalStatus, TaskRunProgress, TaskRunResult } from '@shared/task-run'
import type {
  TaskRunCancellationResult,
  TaskRunCompletionResult,
  TaskRunFailureResult
} from './types'
import { sanitizeCounters, sanitizeWarnings, truncateOptionalString } from './validation'

const MAX_RESULT_TEXT_LENGTH = 1000

export function createFinalResult(
  status: TaskRunFinalStatus,
  result: Omit<TaskRunResult, 'status'>,
  progress: TaskRunProgress | undefined
): TaskRunResult {
  const finalResult: TaskRunResult = {
    ...result,
    status
  }

  if (finalResult.counters === undefined && progress?.counters !== undefined) {
    finalResult.counters = progress.counters
  }
  if (finalResult.warnings === undefined && progress?.warnings !== undefined) {
    finalResult.warnings = progress.warnings
  }

  return finalResult
}

export function sanitizeCompletionResult(
  result: TaskRunCompletionResult | TaskRunFailureResult | TaskRunCancellationResult | undefined
): Omit<TaskRunResult, 'status' | 'error'> {
  if (!result) {
    return {}
  }

  const sanitized: Omit<TaskRunResult, 'status' | 'error'> = {}
  const title = truncateOptionalString(result.title, MAX_RESULT_TEXT_LENGTH)
  const summary = truncateOptionalString(result.summary, MAX_RESULT_TEXT_LENGTH)
  const counters = sanitizeCounters(result.counters)
  const warnings = sanitizeWarnings(result.warnings)

  if (title !== undefined) {
    sanitized.title = title
  }
  if (summary !== undefined) {
    sanitized.summary = summary
  }
  if (result.output !== undefined) {
    sanitized.output = result.output
  }
  if (counters !== undefined) {
    sanitized.counters = counters
  }
  if (warnings !== undefined) {
    sanitized.warnings = warnings
  }

  return sanitized
}

export function toSafeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const trimmed = message.trim()
  return (trimmed || 'Task run failed.').slice(0, MAX_RESULT_TEXT_LENGTH)
}
