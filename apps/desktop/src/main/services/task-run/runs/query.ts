import type { TaskRun, TaskRunFinalStatus, TaskRunStatus } from '@shared/task-run'
import type { TaskRunListQuery } from './types'

const MAX_LIST_LIMIT = 500

export function matchesTaskRunQuery(run: TaskRun, query?: TaskRunListQuery): boolean {
  if (!query) {
    return true
  }

  if (query.categories?.length && !query.categories.includes(run.category)) {
    return false
  }

  if (query.operations?.length && !query.operations.includes(run.operation)) {
    return false
  }

  if (query.ownerTypes?.length && !query.ownerTypes.includes(run.owner.type)) {
    return false
  }

  if (query.initiatorTypes?.length && !query.initiatorTypes.includes(run.initiator.type)) {
    return false
  }

  if (
    'statuses' in query &&
    query.statuses?.length &&
    !query.statuses.includes(run.status as TaskRunFinalStatus)
  ) {
    return false
  }

  if (query.automationId) {
    if (run.initiator.type !== 'automation' || run.initiator.automation.id !== query.automationId) {
      return false
    }
  }

  if (query.extensionId) {
    if (run.owner.type !== 'extension' || run.owner.extension.id !== query.extensionId) {
      return false
    }
  }

  if (query.subject) {
    if (!run.subject || run.subject.type !== query.subject.type) {
      return false
    }

    if (query.subject.id !== undefined && run.subject.id !== query.subject.id) {
      return false
    }
  }

  return true
}

export function cloneTaskRun(run: TaskRun): TaskRun {
  return JSON.parse(JSON.stringify(run)) as TaskRun
}

export function applyListLimit<T>(items: T[], limit: number | undefined): T[] {
  if (!Number.isFinite(limit) || limit === undefined || limit <= 0) {
    return items.slice(0, MAX_LIST_LIMIT)
  }

  return items.slice(0, Math.min(Math.floor(limit), MAX_LIST_LIMIT))
}

export function compareActiveTaskRuns(left: TaskRun, right: TaskRun): number {
  const priority = activeStatusPriority(left.status) - activeStatusPriority(right.status)
  if (priority !== 0) {
    return priority
  }

  return right.updatedAt - left.updatedAt
}

function activeStatusPriority(status: TaskRunStatus): number {
  switch (status) {
    case 'cancelling':
      return 0
    case 'pausing':
    case 'paused':
      return 1
    case 'running':
      return 2
    case 'queued':
      return 3
    default:
      return 4
  }
}
