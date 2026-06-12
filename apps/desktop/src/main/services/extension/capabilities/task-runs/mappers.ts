import type {
  TaskRunInitiator as ExtensionTaskRunInitiator,
  TaskRunProgress as ExtensionTaskRunProgress,
  TaskRunResult as ExtensionTaskRunResult,
  TaskRunSnapshot as ExtensionTaskRunSnapshot,
  TaskRunSubject as ExtensionTaskRunSubject
} from '@kisaki3/extension-api'
import type { TaskRun, TaskRunInitiator, TaskRunOperation, TaskRunSubject } from '@shared/task-run'

export function toInternalExtensionTaskRunOperation(
  extensionId: string,
  operation: string
): TaskRunOperation {
  return `extension.task.${extensionId}.${operation}`
}

export function toPublicExtensionTaskRunSnapshot(
  extensionId: string,
  run: TaskRun
): ExtensionTaskRunSnapshot {
  return {
    id: run.id,
    operation: toPublicExtensionTaskRunOperation(extensionId, run.operation),
    title: run.title,
    description: run.description,
    status: run.status,
    initiator: toPublicInitiator(run.initiator),
    subject: toPublicSubject(run.subject, extensionId),
    controls: { ...run.controls },
    progress: run.progress ? ({ ...run.progress } as ExtensionTaskRunProgress) : undefined,
    result: run.result ? ({ ...run.result } as ExtensionTaskRunResult) : undefined,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    updatedAt: run.updatedAt,
    finishedAt: run.finishedAt
  }
}

export function isOwnExtensionTaskRun(run: TaskRun, extensionId: string): boolean {
  return (
    run.owner.type === 'extension' &&
    run.owner.extension.id === extensionId &&
    run.operation.startsWith(`extension.task.${extensionId}.`)
  )
}

function toPublicExtensionTaskRunOperation(
  extensionId: string,
  operation: TaskRunOperation
): string {
  const prefix = `extension.task.${extensionId}.`
  if (!operation.startsWith(prefix)) {
    throw new Error('Task run operation does not belong to this extension.')
  }

  return operation.slice(prefix.length)
}

function toPublicInitiator(initiator: TaskRunInitiator): ExtensionTaskRunInitiator {
  if (initiator.type === 'automation') {
    return {
      type: 'automation',
      automation: { ...initiator.automation }
    }
  }

  if (initiator.type === 'extension') {
    return {
      type: 'extension',
      extension: { ...initiator.extension }
    }
  }

  if (initiator.type === 'system') {
    return {
      type: 'system',
      reason: initiator.reason
    }
  }

  return { type: 'user' }
}

function toPublicSubject(
  subject: TaskRunSubject | undefined,
  extensionId: string
): ExtensionTaskRunSubject | undefined {
  if (!subject) {
    return undefined
  }

  if (subject.type === 'command') {
    return {
      type: 'command',
      id: subject.id,
      labelSnapshot: subject.labelSnapshot
    }
  }

  if (subject.type === 'extension' && (!subject.id || subject.id === extensionId)) {
    return {
      type: 'extension',
      id: subject.id ?? extensionId,
      labelSnapshot: subject.labelSnapshot
    }
  }

  return undefined
}
