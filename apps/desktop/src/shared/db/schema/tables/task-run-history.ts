import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql, type InferInsertModel, type InferSelectModel } from 'drizzle-orm'

import {
  taskRunCategory,
  taskRunControls,
  taskRunFinalStatus,
  taskRunInitiator,
  taskRunOperation,
  taskRunOwner,
  taskRunProgress,
  taskRunResult,
  taskRunSubject
} from '../../columns'

export const taskRunHistory = sqliteTable(
  'task_run_history',
  {
    id: text('id').primaryKey(),
    category: taskRunCategory('category').notNull(),
    operation: taskRunOperation('operation').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: taskRunFinalStatus('status').notNull(),
    owner: taskRunOwner('owner').notNull(),
    ownerExtensionId: text('owner_extension_id'),
    initiator: taskRunInitiator('initiator').notNull(),
    subject: taskRunSubject('subject'),
    controls: taskRunControls('controls').notNull(),
    progress: taskRunProgress('progress'),
    result: taskRunResult('result'),
    createdAt: integer('created_at').notNull(),
    startedAt: integer('started_at'),
    updatedAt: integer('updated_at').notNull(),
    finishedAt: integer('finished_at')
  },
  (t) => [
    check(
      'task_run_history_final_status_check',
      sql`${t.status} in ('completed', 'failed', 'cancelled')`
    ),
    index('idx_task_run_history_owner_extension_finished_at').on(t.ownerExtensionId, t.finishedAt),
    index('idx_task_run_history_category_finished_at').on(t.category, t.finishedAt),
    index('idx_task_run_history_operation_finished_at').on(t.operation, t.finishedAt),
    index('idx_task_run_history_finished_at').on(t.finishedAt)
  ]
)

export type TaskRunHistoryRow = InferSelectModel<typeof taskRunHistory>
export type NewTaskRunHistoryRow = InferInsertModel<typeof taskRunHistory>
