import type {
  TaskRun,
  TaskRunInitiator,
  TaskRunOperation,
  TaskRunSubject,
  TaskRunWarning
} from '@shared/task-run'
import type { IngestWarning } from '@shared/ingest'
import type { TaskRunHandle, TaskRunService } from '@main/services/task-run'
import { TaskRunCancellation } from '@main/services/task-run'

/** The parts of an ingest task run that differ per operation and entity. */
export interface IngestRunSpec {
  operation: TaskRunOperation
  title: string
  /** User-facing label of the affected entity; doubles as the description. */
  label: string
  subject: { type: TaskRunSubject['type']; id?: string }
  initiator: TaskRunInitiator | undefined
}

/**
 * Creates a task run with the presentation every ingest operation shares:
 * app-owned, cancelable, progress-notifying.
 */
export function createIngestRun(taskRunService: TaskRunService, spec: IngestRunSpec): TaskRunHandle {
  return taskRunService.runs.create({
    category: 'ingest',
    operation: spec.operation,
    title: spec.title,
    description: spec.label,
    owner: { type: 'app' },
    initiator: spec.initiator ?? { type: 'user' },
    subject: {
      type: spec.subject.type,
      ...(spec.subject.id !== undefined && { id: spec.subject.id }),
      labelSnapshot: spec.label
    },
    controls: { cancelable: true, pausable: false },
    presentation: {
      notify: {
        enabled: true,
        title: spec.title,
        showProgress: true,
        showResult: true,
        closable: true
      }
    }
  })
}

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
