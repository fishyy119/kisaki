import { randomUUID } from 'node:crypto'
import { createLogger } from '@main/log'
import {
  readErrorCode,
  type ExtensionRuntimeHandle,
  type SettingsPanelRegistrationInfo
} from '@kisaki/extension-api'
import type {
  ExtensionSettingsPanelCallbackResponse,
  ExtensionSettingsPanelRegistrationInfo,
  ExtensionSettingsPanelInvokeRequest,
  ExtensionSettingsPanelOpenRequest,
  ExtensionSettingsPanelOpenResponse,
  ExtensionSettingsPanelRefreshRequest,
  ExtensionSettingsPanelRefreshResponse,
  ExtensionSettingsPanelRefreshRequestedEvent,
  ExtensionSettingsPanelReleaseRequest,
  ExtensionSettingsPanelSubmitRequest
} from '@shared/extension'
import {
  getRuntimeContributionKey,
  requireContributionOwner,
  type ExtensionContributionReleaseDiagnostic,
  type ExtensionContributionDomainOptions
} from '../types'
import {
  toHostInvokeRequest,
  toHostOpenRequest,
  toHostRefreshRequest,
  toHostReleaseRequest,
  toHostSubmitRequest,
  toResolvedDialog,
  toResolvedPopover,
  toResolvedRoot,
  toSettingsContributionInfo,
  toSettingsSession
} from './requests'
import { SettingsSessionStore } from './sessions'
import type { SettingsRegistration } from './types'
import { createSettingsError, getPublicContributionKey, toErrorMessage } from './shared'

const log = createLogger('Extension')

export class ExtensionSettingsPanelContributionPoint {
  private readonly registrations = new Map<string, SettingsRegistration>()
  private readonly byPublicId = new Map<string, SettingsRegistration>()
  private readonly sessionStore = new SettingsSessionStore()

  constructor(private readonly options: ExtensionContributionDomainOptions) {}

  register(
    runtimeHandle: ExtensionRuntimeHandle,
    contribution: SettingsPanelRegistrationInfo
  ): void {
    const owner = requireContributionOwner(this.options, runtimeHandle)
    const key = getRuntimeContributionKey(runtimeHandle, contribution.id)
    const publicKey = getPublicContributionKey(owner.extension.id, contribution.id)

    if (this.byPublicId.has(publicKey)) {
      throw new Error(
        `Extension "${owner.extension.id}" already registered settings contribution "${contribution.id}".`
      )
    }

    const registration: SettingsRegistration = {
      owner,
      contribution
    }

    this.registrations.set(key, registration)
    this.byPublicId.set(publicKey, registration)
  }

  unregister(runtimeHandle: ExtensionRuntimeHandle, contributionId: string): void {
    const key = getRuntimeContributionKey(runtimeHandle, contributionId)
    const registration = this.registrations.get(key)
    if (!registration) {
      return
    }

    this.registrations.delete(key)
    this.byPublicId.delete(
      getPublicContributionKey(registration.owner.extension.id, contributionId)
    )
    this.sessionStore.clearContributionSessions(registration.owner.extension.id, contributionId)
  }

  releaseRuntime(runtimeHandle: ExtensionRuntimeHandle): void {
    for (const [key, registration] of [...this.registrations]) {
      if (registration.owner.runtimeHandle === runtimeHandle) {
        this.registrations.delete(key)
        this.byPublicId.delete(
          getPublicContributionKey(registration.owner.extension.id, registration.contribution.id)
        )
      }
    }
    this.sessionStore.clearRuntimeSessions(runtimeHandle)
  }

  releaseAll(): void {
    this.registrations.clear()
    this.byPublicId.clear()
    this.sessionStore.clear()
  }

  getSnapshot(): readonly ExtensionSettingsPanelRegistrationInfo[] {
    return [...this.registrations.values()]
      .map(toSettingsContributionInfo)
      .sort(
        (left, right) =>
          left.order - right.order || left.contributionId.localeCompare(right.contributionId)
      )
  }

  getReleaseDiagnostics(extensionId: string): readonly ExtensionContributionReleaseDiagnostic[] {
    const diagnostics: ExtensionContributionReleaseDiagnostic[] = []
    const primaryKeys = new Set<string>()

    for (const registration of this.registrations.values()) {
      if (registration.owner.extension.id !== extensionId) {
        continue
      }

      const publicKey = getPublicContributionKey(extensionId, registration.contribution.id)
      primaryKeys.add(publicKey)
      diagnostics.push({
        domain: 'settings panels',
        detail: registration.contribution.id
      })
    }

    for (const [publicKey, registration] of this.byPublicId) {
      if (registration.owner.extension.id === extensionId && !primaryKeys.has(publicKey)) {
        diagnostics.push({
          domain: 'settings panel index',
          detail: publicKey.slice(extensionId.length + 1)
        })
      }
    }

    diagnostics.push(...this.sessionStore.getReleaseDiagnostics(extensionId))
    return diagnostics
  }

  notifyRefreshRequested(
    runtimeHandle: ExtensionRuntimeHandle,
    contributionId: string,
    reason?: ExtensionSettingsPanelRefreshRequestedEvent['reason']
  ): void {
    const registration = this.registrations.get(
      getRuntimeContributionKey(runtimeHandle, contributionId)
    )
    if (!registration) {
      return
    }

    this.options.onSettingsPanelsRefreshRequested?.({
      extensionId: registration.owner.extension.id,
      contributionId,
      reason
    })
  }

  async open(
    request: ExtensionSettingsPanelOpenRequest
  ): Promise<ExtensionSettingsPanelOpenResponse> {
    const registration = this.requireRegistration(request.extensionId, request.contributionId)

    if (request.surface === 'root') {
      const sessionId = randomUUID()
      const response = await this.options.requestHost(
        'contributions.settingsPanels.open',
        toHostOpenRequest(request, registration, sessionId),
        { timeoutMs: 15_000 }
      )

      if (response.surface !== 'root') {
        throw new Error('Settings host returned an unexpected root open response.')
      }

      this.sessionStore.set({
        extensionId: request.extensionId,
        contributionId: request.contributionId,
        runtimeHandle: registration.owner.runtimeHandle,
        sessionId: response.sessionId,
        root: { revision: 1 }
      })

      return {
        surface: 'root',
        session: toSettingsSession(request.extensionId, request.contributionId, response.sessionId),
        view: toResolvedRoot(response.view)
      }
    }

    const session = this.sessionStore.requireForRegistration(request, registration)
    this.sessionStore.assertRegistrationMatchesSession(session, registration)

    if (request.surface === 'dialog') {
      this.sessionStore.assertRevision(session.root, request.revision, 'settings root')
    } else {
      const parentSurface = this.sessionStore.requireParentSurface(session, request.parent)
      this.sessionStore.assertRevision(parentSurface, request.revision, 'settings popover parent')
    }

    const response = await this.options.requestHost(
      'contributions.settingsPanels.open',
      toHostOpenRequest(request, registration),
      { timeoutMs: 15_000 }
    )

    switch (response.surface) {
      case 'dialog':
        if (request.surface !== 'dialog') {
          throw new Error('Settings host returned an unexpected dialog open response.')
        }
        session.activeRootPopover = undefined
        session.activeDialogPopover = undefined
        session.activeDialog = {
          dialogId: response.dialog.dialogId as string,
          revision: 1
        }
        return {
          surface: 'dialog',
          dialog: toResolvedDialog(response.dialog)
        }

      case 'popover':
        if (request.surface !== 'popover') {
          throw new Error('Settings host returned an unexpected popover open response.')
        }
        this.sessionStore.setActivePopover(session, {
          popoverId: response.popover.popoverId as string,
          parent: request.parent,
          revision: 1
        })
        return {
          surface: 'popover',
          popover: toResolvedPopover(response.popover)
        }

      case 'root':
        throw new Error('Settings host returned an unexpected root open response.')
    }
  }

  async refresh(
    request: ExtensionSettingsPanelRefreshRequest
  ): Promise<ExtensionSettingsPanelRefreshResponse> {
    const registration = this.requireRegistration(request.extensionId, request.contributionId)
    const session = this.sessionStore.requireForRegistration(request, registration)
    this.sessionStore.assertRegistrationMatchesSession(session, registration)
    this.sessionStore.assertRefreshRequest(session, request)

    const response = await this.options.requestHost(
      'contributions.settingsPanels.refresh',
      toHostRefreshRequest(request, registration),
      { timeoutMs: 15_000 }
    )

    switch (response.surface) {
      case 'root':
        if (request.surface !== 'root') {
          throw new Error('Settings host returned an unexpected root refresh response.')
        }
        session.root.revision += 1
        session.activeRootPopover = undefined
        return {
          surface: 'root',
          view: toResolvedRoot(response.view)
        }

      case 'dialog':
        if (request.surface !== 'dialog') {
          throw new Error('Settings host returned an unexpected dialog refresh response.')
        }
        session.activeDialog = {
          dialogId: response.dialog.dialogId as string,
          revision: (session.activeDialog?.revision ?? 0) + 1
        }
        session.activeDialogPopover = undefined
        return {
          surface: 'dialog',
          dialog: toResolvedDialog(response.dialog)
        }

      case 'popover': {
        if (request.surface !== 'popover') {
          throw new Error('Settings host returned an unexpected popover refresh response.')
        }
        const previousPopover = this.sessionStore.requireActivePopover(
          session,
          request.parent,
          request.popoverId
        )
        this.sessionStore.setActivePopover(session, {
          popoverId: response.popover.popoverId as string,
          parent: request.parent,
          revision: previousPopover.revision + 1
        })
        return {
          surface: 'popover',
          popover: toResolvedPopover(response.popover)
        }
      }

      case 'all':
        if (request.surface !== 'all') {
          throw new Error('Settings host returned an unexpected all refresh response.')
        }
        session.root.revision += 1
        session.activeRootPopover = undefined
        session.activeDialogPopover = undefined
        if (response.activeDialog) {
          session.activeDialog = {
            dialogId: response.activeDialog.dialogId,
            revision: (session.activeDialog?.revision ?? 0) + 1
          }
        } else {
          session.activeDialog = undefined
        }
        return {
          surface: 'all',
          view: toResolvedRoot(response.view),
          activeDialog: response.activeDialog
            ? {
                dialogId: response.activeDialog.dialogId,
                dialog: toResolvedDialog(response.activeDialog.dialog)
              }
            : undefined
        }
    }
  }

  async submit(
    request: ExtensionSettingsPanelSubmitRequest
  ): Promise<ExtensionSettingsPanelCallbackResponse> {
    const registration = this.findRegistration(request.extensionId, request.contributionId)
    if (!registration) {
      return {
        result: createSettingsError('Settings contribution is no longer active.', 'unavailable')
      }
    }

    try {
      const session = this.sessionStore.requireForRegistration(request, registration)
      this.sessionStore.assertRegistrationMatchesSession(session, registration)
      this.sessionStore.assertSubmitRequest(session, request)
      return await this.options.requestHost(
        'contributions.settingsPanels.submit',
        toHostSubmitRequest(request, registration),
        { timeoutMs: 15_000 }
      )
    } catch (error) {
      log.warn('Settings submit failed.', error, {
        requestExtensionId: request.extensionId,
        requestContributionId: request.contributionId,
        requestSurface: request.surface
      })
      return {
        result: createSettingsError(
          toErrorMessage(error, 'Settings submit failed.'),
          readErrorCode(error) ?? 'internal'
        )
      }
    }
  }

  async invoke(
    request: ExtensionSettingsPanelInvokeRequest
  ): Promise<ExtensionSettingsPanelCallbackResponse> {
    const registration = this.findRegistration(request.extensionId, request.contributionId)
    if (!registration) {
      return {
        result: createSettingsError('Settings contribution is no longer active.', 'unavailable')
      }
    }

    try {
      const session = this.sessionStore.requireForRegistration(request, registration)
      this.sessionStore.assertRegistrationMatchesSession(session, registration)
      this.sessionStore.assertInvokeRequest(session, request)
      return await this.options.requestHost(
        'contributions.settingsPanels.invoke',
        toHostInvokeRequest(request, registration),
        { timeoutMs: 15_000 }
      )
    } catch (error) {
      log.warn('Settings callback failed.', error, {
        requestExtensionId: request.extensionId,
        requestContributionId: request.contributionId,
        requestSurface: request.surface,
        requestNodeId: request.nodeId
      })
      return {
        result: createSettingsError(
          toErrorMessage(error, 'Settings callback failed.'),
          readErrorCode(error) ?? 'internal'
        )
      }
    }
  }

  async release(request: ExtensionSettingsPanelReleaseRequest): Promise<void> {
    const registration = this.findRegistration(request.extensionId, request.contributionId)
    if (!registration) {
      this.sessionStore.applyRelease(request)
      return
    }

    try {
      await this.options.requestHost(
        'contributions.settingsPanels.release',
        toHostReleaseRequest(request, registration),
        { timeoutMs: 5_000 }
      )
    } catch (error) {
      log.warn('Failed to release settings session.', error, {
        requestExtensionId: request.extensionId,
        requestContributionId: request.contributionId,
        requestSessionId: request.sessionId,
        requestSurface: request.surface
      })
    } finally {
      this.sessionStore.applyRelease(request)
    }
  }

  private requireRegistration(extensionId: string, contributionId: string): SettingsRegistration {
    const registration = this.findRegistration(extensionId, contributionId)
    if (!registration) {
      throw new Error(
        `Settings contribution "${extensionId}:${contributionId}" is no longer active.`
      )
    }
    return registration
  }

  private findRegistration(
    extensionId: string,
    contributionId: string
  ): SettingsRegistration | undefined {
    return this.byPublicId.get(getPublicContributionKey(extensionId, contributionId))
  }
}
