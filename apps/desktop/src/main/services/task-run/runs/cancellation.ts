/**
 * How the app recognizes "the caller asked to stop", and the run outcome that
 * follows from it.
 *
 * Cancellation reaches a run in two shapes: `TaskRunCancellation` from the
 * run's own checkpoints, and a DOM-style `AbortError` from any aborted
 * web-platform or extension call below it. Both mean the same thing, so a
 * single predicate owns the distinction instead of each caller re-deriving it.
 */

import { isAbortError } from '@main/utils/async'
import type { TaskRunHandle } from './types'

export class TaskRunCancellation extends Error {
  override readonly name = 'TaskRunCancellation'

  constructor(message = 'Task run was cancelled.') {
    super(message)
  }
}

export function isTaskRunCancellation(error: unknown): error is TaskRunCancellation {
  return error instanceof TaskRunCancellation
}

/** Use this to classify a caught error; `isTaskRunCancellation` only narrows the type. */
export function isCancellation(error: unknown): boolean {
  return isTaskRunCancellation(error) || isAbortError(error)
}

/**
 * Settles a run from the error that ended it. The run's signal is consulted
 * too because an aborted dependency may surface an error of any shape, and a
 * cancelled run must never be recorded as a failure.
 */
export function finishTaskRunFromError(
  run: TaskRunHandle,
  error: unknown,
  options: { cancelledSummary: string }
): void {
  if (isCancellation(error) || run.context.signal.aborted) {
    run.cancel({ summary: options.cancelledSummary })
    return
  }

  run.fail(error)
}
