import { randomUUID } from 'node:crypto'
import type { DbService } from '@main/services/db'
import { asc, eq } from 'drizzle-orm'
import type {
  Automation,
  AutomationCreateInput,
  AutomationOwner,
  AutomationRunHistoryRecord,
  AutomationTriggers,
  AutomationUpdateInput
} from '@shared/automation'
import { automations, type AutomationRow, type NewAutomationRow } from '@shared/db'
import { assertValidCronTrigger, computeNextCronRunAt } from './cron'
import type { AutomationHistoryStore } from './history/store'

const HISTORY_LIMIT = 50

export interface AutomationStoreOptions {
  db: DbService
  history: AutomationHistoryStore
  onAutomationChanged(automationId: string): void
  onAutomationDeleted(automationId: string): void
}

export class AutomationStore {
  private readonly automationCache = new Map<string, Automation>()

  constructor(private readonly options: AutomationStoreOptions) {}

  load(): void {
    const rows = this.options.db.client
      .select()
      .from(automations)
      .orderBy(asc(automations.createdAt))
      .all()

    for (const row of rows) {
      const automation = this.withNextRun(normalizeStoredAutomation(fromAutomationRow(row)))
      this.automationCache.set(automation.id, automation)
    }
  }

  list(): Automation[] {
    return [...this.automationCache.values()]
      .map((automation) => this.cloneAutomation(automation))
      .sort((left, right) => left.createdAt - right.createdAt)
  }

  get(automationId: string): Automation | null {
    const automation = this.automationCache.get(automationId)
    return automation ? this.cloneAutomation(automation) : null
  }

  async create(input: AutomationCreateInput): Promise<Automation> {
    const now = Date.now()
    const automation: Automation = {
      id: randomUUID(),
      name: input.name?.trim() || input.commandId,
      owner: input.owner ?? { type: 'app' },
      commandId: input.commandId,
      args: input.args ?? {},
      enabled: input.enabled ?? true,
      triggers: normalizeTriggers(input.triggers),
      failurePolicy: input.failurePolicy ?? { type: 'none' },
      createdAt: now,
      updatedAt: now,
      history: []
    }

    const storedAutomation = this.withNextRun(automation)
    this.automationCache.set(storedAutomation.id, storedAutomation)
    this.persistAutomation(storedAutomation)
    this.options.onAutomationChanged(storedAutomation.id)
    return this.cloneAutomation(this.requireCachedAutomation(storedAutomation.id))
  }

  async update(automationId: string, patch: AutomationUpdateInput): Promise<Automation> {
    const automation = this.requireCachedAutomation(automationId)
    const updated: Automation = {
      ...automation,
      ...patch,
      name: patch.name?.trim() || automation.name,
      args: patch.args ?? automation.args,
      triggers:
        patch.triggers === undefined ? automation.triggers : normalizeTriggers(patch.triggers),
      failurePolicy: patch.failurePolicy ?? automation.failurePolicy,
      enabled: patch.enabled === undefined ? automation.enabled : patch.enabled,
      updatedAt: Date.now(),
      history: []
    }

    const storedAutomation = this.withNextRun(updated)
    this.automationCache.set(automationId, storedAutomation)
    this.persistAutomation(storedAutomation)
    this.options.onAutomationChanged(automationId)
    return this.cloneAutomation(this.requireCachedAutomation(automationId))
  }

  async setEnabled(automationId: string, enabled: boolean): Promise<Automation> {
    return this.update(automationId, { enabled })
  }

  async delete(automationId: string): Promise<void> {
    this.automationCache.delete(automationId)
    this.options.db.client.delete(automations).where(eq(automations.id, automationId)).run()
    this.options.history.deleteForAutomation(automationId)
    this.options.onAutomationDeleted(automationId)
  }

  require(automationId: string): Automation {
    return this.cloneAutomation(this.requireCachedAutomation(automationId))
  }

  listStartupAutomationIds(): string[] {
    return [...this.automationCache.values()]
      .filter((automation) => automation.enabled && automation.triggers.onStartup)
      .map((automation) => automation.id)
  }

  listAutomationIds(): string[] {
    return [...this.automationCache.keys()]
  }

  getScheduledAutomation(automationId: string): Automation | null {
    const automation = this.automationCache.get(automationId)
    if (!automation || !automation.enabled || !automation.triggers.cron) {
      return null
    }
    return this.cloneAutomation(automation)
  }

  async recordRun(record: AutomationRunHistoryRecord): Promise<void> {
    const automation = this.requireCachedAutomation(record.automationId)
    const nextAutomation = this.withNextRun({
      ...automation,
      lastRunAt: record.finishedAt,
      updatedAt: Date.now(),
      history: []
    })

    this.options.history.insert(record)
    this.automationCache.set(record.automationId, nextAutomation)
    this.persistAutomation(nextAutomation)
    this.options.onAutomationChanged(record.automationId)
  }

  pauseAfterFailure(automationId: string): void {
    const latest = this.requireCachedAutomation(automationId)
    const paused = this.withNextRun({ ...latest, enabled: false, updatedAt: Date.now() })
    this.automationCache.set(automationId, paused)
    this.persistAutomation(paused)
    this.options.onAutomationChanged(automationId)
  }

  private requireCachedAutomation(automationId: string): Automation {
    const automation = this.automationCache.get(automationId)
    if (!automation) {
      throw new Error(`Automation "${automationId}" not found.`)
    }
    return automation
  }

  private persistAutomation(automation: Automation): void {
    const values = toAutomationRow(automation)
    this.options.db.client
      .insert(automations)
      .values(values)
      .onConflictDoUpdate({
        target: automations.id,
        set: {
          name: values.name,
          owner: values.owner,
          ownerExtensionId: values.ownerExtensionId,
          commandId: values.commandId,
          args: values.args,
          enabled: values.enabled,
          triggers: values.triggers,
          failurePolicy: values.failurePolicy,
          updatedAt: values.updatedAt,
          lastRunAt: values.lastRunAt,
          nextRunAt: values.nextRunAt
        }
      })
      .run()
  }

  private withNextRun(automation: Automation): Automation {
    const nextRunAt =
      automation.enabled && automation.triggers.cron
        ? computeNextCronRunAt(automation.triggers.cron, Date.now())
        : undefined

    if (nextRunAt === undefined) {
      const withoutNextRunAt = { ...automation }
      delete withoutNextRunAt.nextRunAt
      return withoutNextRunAt
    }

    return { ...automation, nextRunAt }
  }

  private cloneAutomation(automation: Automation): Automation {
    const history = this.options.history.list({
      automationId: automation.id,
      limit: HISTORY_LIMIT
    })
    return JSON.parse(JSON.stringify({ ...automation, history })) as Automation
  }
}

function normalizeStoredAutomation(automation: Automation): Automation {
  return {
    ...automation,
    args: automation.args ?? {},
    enabled: automation.enabled ?? true,
    triggers: normalizeTriggers(automation.triggers, { validateCron: false }),
    failurePolicy: automation.failurePolicy ?? { type: 'none' },
    history: []
  }
}

function fromAutomationRow(row: AutomationRow): Automation {
  return {
    id: row.id,
    name: row.name,
    owner: row.owner,
    commandId: row.commandId,
    args: row.args,
    enabled: row.enabled,
    triggers: row.triggers,
    failurePolicy: row.failurePolicy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastRunAt: row.lastRunAt ?? undefined,
    nextRunAt: row.nextRunAt ?? undefined,
    history: []
  }
}

function toAutomationRow(automation: Automation): NewAutomationRow {
  return {
    id: automation.id,
    name: automation.name,
    owner: automation.owner,
    ownerExtensionId: getOwnerExtensionId(automation.owner),
    commandId: automation.commandId,
    args: automation.args,
    enabled: automation.enabled,
    triggers: automation.triggers,
    failurePolicy: automation.failurePolicy,
    createdAt: automation.createdAt,
    updatedAt: automation.updatedAt,
    lastRunAt: automation.lastRunAt ?? null,
    nextRunAt: automation.nextRunAt ?? null
  }
}

function getOwnerExtensionId(owner: AutomationOwner): string | null {
  return owner.type === 'extension' ? owner.extension.id : null
}

function normalizeTriggers(
  triggers: AutomationTriggers | undefined,
  options: { validateCron?: boolean } = {}
): AutomationTriggers {
  const normalized: AutomationTriggers = {
    onStartup: triggers?.onStartup ?? false
  }

  const cron = triggers?.cron
  if (!cron) {
    return normalized
  }

  const expression = cron.expression.trim()
  if (!expression) {
    return normalized
  }

  const timezone = cron.timezone?.trim()
  normalized.cron = timezone ? { expression, timezone } : { expression }
  if (options.validateCron !== false) {
    assertValidCronTrigger(normalized.cron)
  } else if (computeNextCronRunAt(normalized.cron, Date.now()) === undefined) {
    delete normalized.cron
  }
  return normalized
}
