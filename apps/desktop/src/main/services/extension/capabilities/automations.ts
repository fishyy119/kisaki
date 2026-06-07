import {
  createUnavailableError,
  toJsonObject,
  type Automation,
  type AutomationCreateInput,
  type AutomationRunHistoryRecord,
  type AutomationUpdateInput,
  type ExtensionRuntimeMetadata
} from '@kisaki3/extension-api'
import type { AutomationService } from '@main/services/automation'
import type { CommandService } from '@main/services/command'
import type {
  Automation as AppAutomation,
  AutomationOwner,
  AutomationRunHistoryRecord as AppAutomationRunHistoryRecord
} from '@shared/automation'

export interface ExtensionAutomationsCapabilityProviderOptions {
  automation: AutomationService
  command: CommandService
  resolveRuntimeHandle(runtimeHandle: string): ExtensionRuntimeMetadata | null | undefined
}

export class ExtensionAutomationsCapabilityProvider {
  constructor(private readonly options: ExtensionAutomationsCapabilityProviderOptions) {}

  list(runtimeHandle: string): Automation[] {
    const metadata = this.requireRuntime(runtimeHandle)
    return this.options.automation.store
      .list()
      .filter((automation) => isOwnedByExtension(automation, metadata.id))
      .map((automation) => toPublicAutomation(automation))
  }

  get(runtimeHandle: string, automationId: string): Automation | null {
    const metadata = this.requireRuntime(runtimeHandle)
    const automation = this.options.automation.store.get(automationId)
    if (!automation || !isOwnedByExtension(automation, metadata.id)) {
      return null
    }
    return toPublicAutomation(automation)
  }

  async create(runtimeHandle: string, input: AutomationCreateInput): Promise<Automation> {
    const metadata = this.requireRuntime(runtimeHandle)
    this.assertCommandOwnedByExtension(metadata, input.commandId)
    const automation = await this.options.automation.store.create({
      name: input.name,
      owner: toExtensionOwner(metadata),
      commandId: input.commandId,
      args: input.args,
      enabled: input.enabled,
      triggers: input.triggers,
      failurePolicy: input.failurePolicy
    })
    return toPublicAutomation(automation)
  }

  async update(
    runtimeHandle: string,
    automationId: string,
    patch: AutomationUpdateInput
  ): Promise<Automation> {
    const metadata = this.requireRuntime(runtimeHandle)
    this.requireOwnedAutomation(metadata, automationId)
    if (patch.commandId) {
      this.assertCommandOwnedByExtension(metadata, patch.commandId)
    }

    const automation = await this.options.automation.store.update(automationId, patch)
    return toPublicAutomation(automation)
  }

  async setEnabled(
    runtimeHandle: string,
    automationId: string,
    enabled: boolean
  ): Promise<Automation> {
    const metadata = this.requireRuntime(runtimeHandle)
    this.requireOwnedAutomation(metadata, automationId)
    return toPublicAutomation(await this.options.automation.store.setEnabled(automationId, enabled))
  }

  async delete(runtimeHandle: string, automationId: string): Promise<void> {
    const metadata = this.requireRuntime(runtimeHandle)
    this.requireOwnedAutomation(metadata, automationId)
    await this.options.automation.store.delete(automationId)
  }

  async run(
    runtimeHandle: string,
    automationId: string
  ): Promise<AutomationRunHistoryRecord | null> {
    const metadata = this.requireRuntime(runtimeHandle)
    this.requireOwnedAutomation(metadata, automationId)
    const record = await this.options.automation.runner.runNow(automationId)
    return record ? toPublicAutomationRunRecord(record) : null
  }

  private assertCommandOwnedByExtension(
    metadata: ExtensionRuntimeMetadata,
    commandId: string
  ): void {
    const command = this.options.command.registry.get(commandId)
    if (!command) {
      throw new Error(`Command "${commandId}" is not registered.`)
    }

    if (command.ownerExtensionId !== metadata.id) {
      throw new Error(
        `Extension "${metadata.id}" cannot create automations for command "${commandId}".`
      )
    }
  }

  private requireOwnedAutomation(
    metadata: ExtensionRuntimeMetadata,
    automationId: string
  ): AppAutomation {
    const automation = this.options.automation.store.get(automationId)
    if (!automation || !isOwnedByExtension(automation, metadata.id)) {
      throw new Error(`Automation "${automationId}" is not owned by "${metadata.id}".`)
    }
    return automation
  }

  private requireRuntime(runtimeHandle: string): ExtensionRuntimeMetadata {
    const metadata = this.options.resolveRuntimeHandle(runtimeHandle)
    if (!metadata) {
      throw createUnavailableError(`Runtime handle "${runtimeHandle}" is not active.`)
    }

    return metadata
  }
}

function toExtensionOwner(metadata: ExtensionRuntimeMetadata): AutomationOwner {
  return {
    type: 'extension',
    extension: {
      id: metadata.id,
      nameSnapshot: metadata.name
    }
  }
}

function isOwnedByExtension(automation: AppAutomation, extensionId: string): boolean {
  return automation.owner.type === 'extension' && automation.owner.extension.id === extensionId
}

function toPublicAutomation(automation: AppAutomation): Automation {
  return {
    id: automation.id,
    name: automation.name,
    commandId: automation.commandId,
    args: toJsonObject(automation.args, 'automation args'),
    enabled: automation.enabled,
    triggers: automation.triggers,
    failurePolicy: automation.failurePolicy,
    createdAt: automation.createdAt,
    updatedAt: automation.updatedAt,
    lastRunAt: automation.lastRunAt,
    nextRunAt: automation.nextRunAt,
    history: automation.history.map((record) => toPublicAutomationRunRecord(record))
  }
}

function toPublicAutomationRunRecord(
  record: AppAutomationRunHistoryRecord
): AutomationRunHistoryRecord {
  return {
    id: record.id,
    automationId: record.automationId,
    automationNameSnapshot: record.automationNameSnapshot,
    commandId: record.commandId,
    commandTitleSnapshot: record.commandTitleSnapshot,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    invocationStatus: record.invocationStatus,
    attempt: record.attempt,
    trigger: record.trigger,
    error: record.error
  }
}
