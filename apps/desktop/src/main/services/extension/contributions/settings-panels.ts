import { randomUUID } from 'node:crypto'
import log from 'electron-log/main'
import {
  createUiError,
  readErrorCode,
  type ExtensionRuntimeHandle,
  type SettingsPanelContributionRegistration
} from '@kisaki/extension-api'
import type {
  ExtensionResolvedSettingsPanel,
  ExtensionSettingsPanelCallbackResult,
  ExtensionSettingsPanelInfo,
  ExtensionSettingsPanelInvokeRequest,
  ExtensionSettingsPanelSubmitRequest
} from '@shared/extension'
import {
  getRuntimeContributionKey,
  requireContributionOwner,
  toContributionOwnerInfo,
  type ExtensionContributionHostOptions,
  type RuntimeContributionOwner
} from './types'

interface SettingsPanelRegistration {
  owner: RuntimeContributionOwner
  contribution: SettingsPanelContributionRegistration
}

export class ExtensionSettingsPanelContributionHost {
  private readonly registrations = new Map<string, SettingsPanelRegistration>()
  private readonly byPublicId = new Map<string, SettingsPanelRegistration>()
  private readonly byExtensionId = new Map<string, SettingsPanelRegistration>()

  constructor(private readonly options: ExtensionContributionHostOptions) {}

  register(
    runtimeHandle: ExtensionRuntimeHandle,
    contribution: SettingsPanelContributionRegistration
  ): void {
    const owner = requireContributionOwner(this.options, runtimeHandle)
    const existing = this.byExtensionId.get(owner.extension.id)
    if (existing) {
      throw new Error(
        `Extension "${owner.extension.id}" already registered settings panel "${existing.contribution.id}". Each extension can register only one settings panel.`
      )
    }

    const registration: SettingsPanelRegistration = {
      owner,
      contribution
    }

    this.registrations.set(getRuntimeContributionKey(runtimeHandle, contribution.id), registration)
    this.byPublicId.set(getPublicPanelKey(owner.extension.id, contribution.id), registration)
    this.byExtensionId.set(owner.extension.id, registration)
  }

  unregister(runtimeHandle: ExtensionRuntimeHandle, panelId: string): void {
    const registration = this.registrations.get(getRuntimeContributionKey(runtimeHandle, panelId))
    if (!registration) {
      return
    }

    this.registrations.delete(getRuntimeContributionKey(runtimeHandle, panelId))
    this.byPublicId.delete(getPublicPanelKey(registration.owner.extension.id, panelId))
    this.byExtensionId.delete(registration.owner.extension.id)
  }

  releaseRuntime(runtimeHandle: ExtensionRuntimeHandle): void {
    for (const [key, registration] of [...this.registrations]) {
      if (registration.owner.runtimeHandle === runtimeHandle) {
        this.registrations.delete(key)
        this.byPublicId.delete(
          getPublicPanelKey(registration.owner.extension.id, registration.contribution.id)
        )
        this.byExtensionId.delete(registration.owner.extension.id)
      }
    }
  }

  releaseAll(): void {
    this.registrations.clear()
    this.byPublicId.clear()
    this.byExtensionId.clear()
  }

  getSnapshot(): readonly ExtensionSettingsPanelInfo[] {
    return [...this.registrations.values()]
      .map(toSettingsPanelInfo)
      .sort((left, right) => left.order - right.order || left.panelId.localeCompare(right.panelId))
  }

  resolve(extensionId: string, panelId: string): Promise<ExtensionResolvedSettingsPanel> {
    return this.resolveSession(randomUUID(), extensionId, panelId)
  }

  async submit(
    request: ExtensionSettingsPanelSubmitRequest
  ): Promise<ExtensionSettingsPanelCallbackResult> {
    const registration = this.findRegistration(request.extensionId, request.panelId)
    if (!registration) {
      return {
        result: createUiError('Settings panel is no longer active.', {
          code: 'unavailable'
        })
      }
    }

    try {
      const result = await this.options.requestHost(
        'settingsPanels.submit',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          panelId: registration.contribution.id,
          sessionId: request.sessionId,
          values: request.values
        },
        { timeoutMs: 15_000 }
      )

      return {
        result,
        refreshed: result.refresh
          ? await this.resolveSession(request.sessionId, request.extensionId, request.panelId)
          : undefined
      }
    } catch (error) {
      log.warn(
        `[ExtensionContributionRegistry] Settings panel submit "${request.extensionId}:${request.panelId}" failed:`,
        error
      )
      return {
        result: createUiError(toErrorMessage(error, 'Settings panel submit failed.'), {
          code: readErrorCode(error) ?? 'internal'
        })
      }
    }
  }

  async invoke(
    request: ExtensionSettingsPanelInvokeRequest
  ): Promise<ExtensionSettingsPanelCallbackResult> {
    const registration = this.findRegistration(request.extensionId, request.panelId)
    if (!registration) {
      return {
        result: createUiError('Settings panel is no longer active.', {
          code: 'unavailable'
        })
      }
    }

    try {
      const result = await this.options.requestHost(
        'settingsPanels.invoke',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          panelId: registration.contribution.id,
          sessionId: request.sessionId,
          callbackId: request.callbackId,
          value: request.value
        },
        { timeoutMs: 15_000 }
      )

      return {
        result,
        refreshed: result.refresh
          ? await this.resolveSession(request.sessionId, request.extensionId, request.panelId)
          : undefined
      }
    } catch (error) {
      log.warn(
        `[ExtensionContributionRegistry] Settings panel callback "${request.extensionId}:${request.panelId}" failed:`,
        error
      )
      return {
        result: createUiError(toErrorMessage(error, 'Settings panel callback failed.'), {
          code: readErrorCode(error) ?? 'internal'
        })
      }
    }
  }

  private async resolveSession(
    sessionId: string,
    extensionId: string,
    panelId: string
  ): Promise<ExtensionResolvedSettingsPanel> {
    const registration = this.findRegistration(extensionId, panelId)
    if (!registration) {
      throw new Error(`Settings panel "${extensionId}:${panelId}" is no longer active.`)
    }

    const resolved = await this.options.requestHost(
      'settingsPanels.resolve',
      {
        runtimeHandle: registration.owner.runtimeHandle,
        panelId: registration.contribution.id,
        sessionId
      },
      { timeoutMs: 15_000 }
    )

    return {
      sessionId,
      extensionId,
      panelId,
      nodes: resolved.nodes
    }
  }

  private findRegistration(
    extensionId: string,
    panelId: string
  ): SettingsPanelRegistration | undefined {
    return this.byPublicId.get(getPublicPanelKey(extensionId, panelId))
  }
}

function toSettingsPanelInfo(registration: SettingsPanelRegistration): ExtensionSettingsPanelInfo {
  return {
    ...toContributionOwnerInfo(registration.owner),
    panelId: registration.contribution.id,
    title: registration.contribution.title,
    description: registration.contribution.description,
    order: registration.contribution.order ?? 0
  }
}

function getPublicPanelKey(extensionId: string, panelId: string): string {
  return `${extensionId}:${panelId}`
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
