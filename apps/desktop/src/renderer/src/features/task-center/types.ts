import type { TaskRunCategory, TaskRunStatus } from '@shared/task-run'

export type TaskCenterTab = 'active' | 'completed'

export type TaskRunCategoryFilter = TaskRunCategory | 'all'
export type TaskRunStatusFilter = TaskRunStatus | 'all'
