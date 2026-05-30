import type { TaskRun } from '@shared/task-run'

export interface TaskPauseController {
  readonly promise: Promise<void>
  readonly requestedAt: number
  resolve(): void
}

export function createTaskPauseController(requestedAt = Date.now()): TaskPauseController {
  let resolve!: () => void
  const promise = new Promise<void>((innerResolve) => {
    resolve = innerResolve
  })

  return {
    promise,
    requestedAt,
    resolve
  }
}

export interface TaskRunCancelRequest {
  runId: string
  run: TaskRun
  requestedAt: number
}

export type TaskRunCancelRequestListener = (request: TaskRunCancelRequest) => void
