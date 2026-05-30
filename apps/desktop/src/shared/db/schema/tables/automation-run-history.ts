import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import {
  automationCommandInvocationStatus,
  automationInvocationError,
  automationOwner
} from '../../columns'

export const automationRunHistory = sqliteTable(
  'automation_run_history',
  {
    id: text('id').primaryKey(),
    automationId: text('automation_id').notNull(),
    automationNameSnapshot: text('automation_name_snapshot').notNull(),
    owner: automationOwner('owner').notNull(),
    ownerExtensionId: text('owner_extension_id'),
    trigger: text('trigger', { enum: ['manual', 'startup', 'cron'] }).notNull(),
    attempt: integer('attempt').notNull(),
    commandId: text('command_id').notNull(),
    commandTitleSnapshot: text('command_title_snapshot'),
    startedAt: integer('started_at').notNull(),
    finishedAt: integer('finished_at').notNull(),
    invocationStatus: automationCommandInvocationStatus('invocation_status').notNull(),
    error: automationInvocationError('error')
  },
  (t) => [
    index('idx_automation_run_history_automation_finished_at').on(t.automationId, t.finishedAt),
    index('idx_automation_run_history_command_finished_at').on(t.commandId, t.finishedAt),
    index('idx_automation_run_history_owner_extension_finished_at').on(
      t.ownerExtensionId,
      t.finishedAt
    ),
    index('idx_automation_run_history_finished_at').on(t.finishedAt)
  ]
)

export type AutomationRunHistoryRow = InferSelectModel<typeof automationRunHistory>
export type NewAutomationRunHistoryRow = InferInsertModel<typeof automationRunHistory>
