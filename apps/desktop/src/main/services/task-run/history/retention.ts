import type { TaskRun } from '@shared/task-run'

export interface TaskRunHistoryRetentionPolicy {
  maxItems: number
  maxAgeMs: number
}

export const DEFAULT_TASK_RUN_HISTORY_RETENTION: TaskRunHistoryRetentionPolicy = {
  maxItems: 500,
  maxAgeMs: 30 * 24 * 60 * 60 * 1000
}

export function selectTaskRunHistoryPruneIds(
  runs: readonly TaskRun[],
  now = Date.now(),
  policy: TaskRunHistoryRetentionPolicy = DEFAULT_TASK_RUN_HISTORY_RETENTION
): string[] {
  const cutoff = now - policy.maxAgeMs
  return runs
    .slice()
    .sort((left, right) => (right.finishedAt ?? 0) - (left.finishedAt ?? 0))
    .filter((run, index) => index >= policy.maxItems && (run.finishedAt ?? 0) < cutoff)
    .map((run) => run.id)
}
