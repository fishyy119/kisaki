import type { TaskRunFinalStatus, TaskRunStatus } from '@shared/task-run'

const FINAL_STATUSES = new Set<TaskRunStatus>(['completed', 'failed', 'cancelled'])

const ALLOWED_TRANSITIONS: ReadonlyMap<TaskRunStatus, readonly TaskRunStatus[]> = new Map([
  ['queued', ['running', 'cancelled']],
  ['running', ['pausing', 'cancelling', 'completed', 'failed', 'cancelled']],
  ['pausing', ['paused', 'running', 'cancelling', 'cancelled']],
  ['paused', ['running', 'cancelling', 'cancelled']],
  ['cancelling', ['cancelled']],
  ['completed', []],
  ['failed', []],
  ['cancelled', []]
])

export function isTaskRunFinalStatus(status: TaskRunStatus): status is TaskRunFinalStatus {
  return FINAL_STATUSES.has(status)
}

export function assertTaskRunTransition(from: TaskRunStatus, to: TaskRunStatus): void {
  if (from === to) {
    return
  }

  if (!ALLOWED_TRANSITIONS.get(from)?.includes(to)) {
    throw new Error(`Invalid task run status transition from "${from}" to "${to}".`)
  }
}

export function assertTaskRunActiveStatus(status: TaskRunStatus): void {
  if (isTaskRunFinalStatus(status)) {
    throw new Error('Task run is already finished.')
  }
}
