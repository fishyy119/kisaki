import type { TaskRun, TaskRunWarning } from '@shared/task-run'
import type { IngestWarning } from '@shared/ingest'
import type { TaskRunService } from '@main/services/task-run'
import { TaskRunCancellation } from '@main/services/task-run'

export function toTaskRunWarnings(
  warnings: readonly IngestWarning[] | undefined
): readonly TaskRunWarning[] | undefined {
  return warnings?.map((warning) => ({
    code: warning.code,
    message: warning.message
  }))
}

export async function waitForIngestRunOutput<T>(
  taskRun: TaskRunService,
  runId: string
): Promise<T> {
  const finalRun = await taskRun.runs.wait(runId)
  if (finalRun.status === 'completed') {
    return finalRun.result?.output as T
  }

  if (finalRun.status === 'cancelled') {
    throw new TaskRunCancellation()
  }

  throw new Error(finalRun.result?.error ?? 'Ingest task run failed.')
}

export function getTaskRunErrorSummary(run: TaskRun): string {
  if (run.status === 'cancelled') {
    return 'Task run was cancelled.'
  }

  return run.result?.error ?? 'Task run failed.'
}
