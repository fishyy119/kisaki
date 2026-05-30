import type {
  TaskRun,
  TaskRunActiveListQuery,
  TaskRunCategory,
  TaskRunControls,
  TaskRunHistoryListQuery,
  TaskRunInitiator,
  TaskRunOperation,
  TaskRunOwner,
  TaskRunPresentation,
  TaskRunResult,
  TaskRunSubject
} from '@shared/task-run'
import type { TaskRunRateCalculator } from '../rate'
import type { TaskPauseController } from './controls'
import type { TaskRunContext } from './context'

export interface TaskRunCreateInput {
  category: TaskRunCategory
  operation: TaskRunOperation
  title: string
  description?: string
  owner: TaskRunOwner
  initiator: TaskRunInitiator
  subject?: TaskRunSubject
  controls: TaskRunControls
  presentation?: TaskRunPresentation
}

export type TaskRunCompletionResult = Omit<TaskRunResult, 'status' | 'error'>
export type TaskRunFailureResult = Omit<TaskRunResult, 'status' | 'error'>
export type TaskRunCancellationResult = Omit<TaskRunResult, 'status' | 'error'>

export interface TaskRunHandle {
  readonly id: string
  readonly createdAt: number
  readonly context: TaskRunContext
  start(): void
  updateControls(controls: Partial<TaskRunControls>): void
  complete(result?: TaskRunCompletionResult): void
  fail(error: unknown, result?: TaskRunFailureResult): void
  cancel(result?: TaskRunCancellationResult): void
}

export interface TaskRunWaiter {
  resolve(run: TaskRun): void
  reject(error: Error): void
}

export interface ActiveTaskRunRecord {
  run: TaskRun
  readonly presentation?: TaskRunPresentation
  readonly controller: AbortController
  readonly context: TaskRunContext
  pause?: TaskPauseController
  readonly waiters: TaskRunWaiter[]
  readonly rate: TaskRunRateCalculator
  lastFlushedAt: number
}

export type TaskRunListQuery = TaskRunActiveListQuery | TaskRunHistoryListQuery
