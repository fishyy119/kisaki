import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import {
  backgroundTaskArgs,
  backgroundTaskCreatedBy,
  backgroundTaskFailurePolicy,
  backgroundTaskHistory,
  backgroundTaskTriggers
} from '../../columns'

export const backgroundTasks = sqliteTable(
  'background_tasks',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    ownerExtensionId: text('owner_extension_id'),
    createdBy: backgroundTaskCreatedBy('created_by').notNull().default('user'),
    commandId: text('command_id').notNull(),
    args: backgroundTaskArgs('args').notNull().default({}),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    triggers: backgroundTaskTriggers('triggers').notNull().default({ onStartup: false }),
    failurePolicy: backgroundTaskFailurePolicy('failure_policy')
      .notNull()
      .default({ type: 'none' }),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    lastRunAt: integer('last_run_at'),
    nextRunAt: integer('next_run_at'),
    history: backgroundTaskHistory('history').notNull().default([])
  },
  (t) => [
    index('idx_background_tasks_owner_extension_id').on(t.ownerExtensionId),
    index('idx_background_tasks_command_id').on(t.commandId),
    index('idx_background_tasks_enabled_next_run_at').on(t.enabled, t.nextRunAt)
  ]
)

export type BackgroundTaskRow = InferSelectModel<typeof backgroundTasks>
export type NewBackgroundTaskRow = InferInsertModel<typeof backgroundTasks>
