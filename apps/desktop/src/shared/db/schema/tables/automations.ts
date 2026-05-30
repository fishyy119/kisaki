import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import {
  automationArgs,
  automationFailurePolicy,
  automationOwner,
  automationTriggers
} from '../../columns'

export const automations = sqliteTable(
  'automations',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    owner: automationOwner('owner').notNull().default({ type: 'app' }),
    ownerExtensionId: text('owner_extension_id'),
    commandId: text('command_id').notNull(),
    args: automationArgs('args').notNull().default({}),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    triggers: automationTriggers('triggers').notNull().default({ onStartup: false }),
    failurePolicy: automationFailurePolicy('failure_policy').notNull().default({ type: 'none' }),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    lastRunAt: integer('last_run_at'),
    nextRunAt: integer('next_run_at')
  },
  (t) => [
    index('idx_automations_owner_extension_id').on(t.ownerExtensionId),
    index('idx_automations_command_id').on(t.commandId),
    index('idx_automations_enabled_next_run_at').on(t.enabled, t.nextRunAt)
  ]
)

export type AutomationRow = InferSelectModel<typeof automations>
export type NewAutomationRow = InferInsertModel<typeof automations>
