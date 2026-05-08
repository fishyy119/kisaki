import { randomUUID } from 'node:crypto'
import log from 'electron-log/main'
import {
  readErrorCode,
  type ExtensionRuntimeHandle,
  type SettingsCallbackResult,
  type SettingsContributionRegistration,
  type SettingsOpenRequest as HostSettingsOpenRequest,
  type SettingsRefreshRequest as HostSettingsRefreshRequest,
  type SettingsReleaseRequest as HostSettingsReleaseRequest,
  type SettingsResolvedSurfacePayload,
  type SettingsSubmitRequest as HostSettingsSubmitRequest,
  type SettingsInvokeRequest as HostSettingsInvokeRequest
} from '@kisaki/extension-api'
import type {
  ExtensionResolvedSettingsDialog,
  ExtensionResolvedSettingsPopover,
  ExtensionResolvedSettingsRoot,
  ExtensionSettingsCallbackResponse,
  ExtensionSettingsContributionInfo,
  ExtensionSettingsInvokeRequest,
  ExtensionSettingsOpenRequest,
  ExtensionSettingsOpenResponse,
  ExtensionSettingsRefreshRequest,
  ExtensionSettingsRefreshResponse,
  ExtensionSettingsRefreshRequestedEvent,
  ExtensionSettingsReleaseRequest,
  ExtensionSettingsSession,
  ExtensionSettingsSubmitRequest
} from '@shared/extension'
import {
  getRuntimeContributionKey,
  requireContributionOwner,
  toContributionOwnerInfo,
  type ExtensionContributionHostOptions,
  type RuntimeContributionOwner
} from './types'

interface SettingsRegistration {
  owner: RuntimeContributionOwner
  contribution: SettingsContributionRegistration
}

export class ExtensionSettingsContributionHost {
  private readonly registrations = new Map<string, SettingsRegistration>()
  private readonly byPublicId = new Map<string, SettingsRegistration>()

  constructor(private readonly options: ExtensionContributionHostOptions) {}

  register(
    runtimeHandle: ExtensionRuntimeHandle,
    contribution: SettingsContributionRegistration
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
  }

  releaseAll(): void {
    this.registrations.clear()
    this.byPublicId.clear()
  }

  getSnapshot(): readonly ExtensionSettingsContributionInfo[] {
    return [...this.registrations.values()]
      .map(toSettingsContributionInfo)
      .sort(
        (left, right) =>
          left.order - right.order || left.contributionId.localeCompare(right.contributionId)
      )
  }

  notifyRefreshRequested(
    runtimeHandle: ExtensionRuntimeHandle,
    contributionId: string,
    reason?: ExtensionSettingsRefreshRequestedEvent['reason']
  ): void {
    const registration = this.registrations.get(
      getRuntimeContributionKey(runtimeHandle, contributionId)
    )
    if (!registration) {
      return
    }

    this.options.onSettingsRefreshRequested?.({
      extensionId: registration.owner.extension.id,
      contributionId,
      reason
    })
  }

  async open(request: ExtensionSettingsOpenRequest): Promise<ExtensionSettingsOpenResponse> {
    const registration = this.requireRegistration(request.extensionId, request.contributionId)
    const hostRequest = toHostOpenRequest(request, registration)
    const response = await this.options.requestHost('contributions.settings.open', hostRequest, {
      timeoutMs: 15_000
    })

    switch (response.surface) {
      case 'root':
        return {
          surface: 'root',
          session: toSettingsSession(
            request.extensionId,
            request.contributionId,
            response.sessionId
          ),
          view: toResolvedRoot(response.view)
        }

      case 'dialog':
        return {
          surface: 'dialog',
          dialog: toResolvedDialog(response.dialog)
        }

      case 'popover':
        return {
          surface: 'popover',
          popover: toResolvedPopover(response.popover)
        }
    }
  }

  async refresh(
    request: ExtensionSettingsRefreshRequest
  ): Promise<ExtensionSettingsRefreshResponse> {
    const registration = this.requireRegistration(request.extensionId, request.contributionId)
    const response = await this.options.requestHost(
      'contributions.settings.refresh',
      toHostRefreshRequest(request, registration),
      { timeoutMs: 15_000 }
    )

    switch (response.surface) {
      case 'root':
        return {
          surface: 'root',
          view: toResolvedRoot(response.view)
        }

      case 'dialog':
        return {
          surface: 'dialog',
          dialog: toResolvedDialog(response.dialog)
        }

      case 'popover':
        return {
          surface: 'popover',
          popover: toResolvedPopover(response.popover)
        }

      case 'all':
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
    request: ExtensionSettingsSubmitRequest
  ): Promise<ExtensionSettingsCallbackResponse> {
    const registration = this.findRegistration(request.extensionId, request.contributionId)
    if (!registration) {
      return {
        result: createSettingsError('Settings contribution is no longer active.', 'unavailable')
      }
    }

    try {
      return await this.options.requestHost(
        'contributions.settings.submit',
        toHostSubmitRequest(request, registration),
        { timeoutMs: 15_000 }
      )
    } catch (error) {
      log.warn(
        `[ExtensionContributionRegistry] Settings submit "${request.extensionId}:${request.contributionId}:${request.surface}" failed:`,
        error
      )
      return {
        result: createSettingsError(
          toErrorMessage(error, 'Settings submit failed.'),
          readErrorCode(error) ?? 'internal'
        )
      }
    }
  }

  async invoke(
    request: ExtensionSettingsInvokeRequest
  ): Promise<ExtensionSettingsCallbackResponse> {
    const registration = this.findRegistration(request.extensionId, request.contributionId)
    if (!registration) {
      return {
        result: createSettingsError('Settings contribution is no longer active.', 'unavailable')
      }
    }

    try {
      return await this.options.requestHost(
        'contributions.settings.invoke',
        toHostInvokeRequest(request, registration),
        { timeoutMs: 15_000 }
      )
    } catch (error) {
      log.warn(
        `[ExtensionContributionRegistry] Settings callback "${request.extensionId}:${request.contributionId}:${request.surface}:${request.nodeId}" failed:`,
        error
      )
      return {
        result: createSettingsError(
          toErrorMessage(error, 'Settings callback failed.'),
          readErrorCode(error) ?? 'internal'
        )
      }
    }
  }

  async release(request: ExtensionSettingsReleaseRequest): Promise<void> {
    const registration = this.findRegistration(request.extensionId, request.contributionId)
    if (!registration) {
      return
    }

    try {
      await this.options.requestHost(
        'contributions.settings.release',
        toHostReleaseRequest(request, registration),
        { timeoutMs: 5_000 }
      )
    } catch (error) {
      log.warn(
        `[ExtensionContributionRegistry] Failed to release settings "${request.extensionId}:${request.contributionId}:${request.sessionId}:${request.surface}":`,
        error
      )
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

function toSettingsContributionInfo(
  registration: SettingsRegistration
): ExtensionSettingsContributionInfo {
  return {
    ...toContributionOwnerInfo(registration.owner),
    contributionId: registration.contribution.id,
    title: registration.contribution.title,
    description: registration.contribution.description,
    order: registration.contribution.order ?? 0
  }
}

function toHostOpenRequest(
  request: ExtensionSettingsOpenRequest,
  registration: SettingsRegistration
): HostSettingsOpenRequest {
  if (request.surface === 'root') {
    return {
      runtimeHandle: registration.owner.runtimeHandle,
      contributionId: registration.contribution.id,
      surface: 'root',
      sessionId: randomUUID(),
      reason: request.reason
    }
  }

  if (request.surface === 'dialog') {
    return {
      runtimeHandle: registration.owner.runtimeHandle,
      contributionId: registration.contribution.id,
      surface: 'dialog',
      sessionId: request.sessionId,
      dialogId: request.dialogId,
      params: request.params,
      parentDraft: request.parentDraft,
      revision: request.revision
    }
  }

  return {
    runtimeHandle: registration.owner.runtimeHandle,
    contributionId: registration.contribution.id,
    surface: 'popover',
    sessionId: request.sessionId,
    popoverId: request.popoverId,
    parent: request.parent,
    params: request.params,
    parentDraft: request.parentDraft,
    anchorNodeKey: request.anchorNodeKey,
    revision: request.revision
  }
}

function toHostRefreshRequest(
  request: ExtensionSettingsRefreshRequest,
  registration: SettingsRegistration
): HostSettingsRefreshRequest {
  const base = {
    runtimeHandle: registration.owner.runtimeHandle,
    contributionId: registration.contribution.id,
    sessionId: request.sessionId
  }

  switch (request.surface) {
    case 'root':
      return {
        ...base,
        surface: 'root',
        draft: request.draft,
        reason: request.reason,
        revision: request.revision
      }

    case 'dialog':
      return {
        ...base,
        surface: 'dialog',
        dialogId: request.dialogId,
        draft: request.draft,
        parentDraft: request.parentDraft,
        reason: request.reason,
        revision: request.revision
      }

    case 'popover':
      return {
        ...base,
        surface: 'popover',
        popoverId: request.popoverId,
        parent: request.parent,
        draft: request.draft,
        parentDraft: request.parentDraft,
        reason: request.reason,
        revision: request.revision
      }

    case 'all':
      return {
        ...base,
        surface: 'all',
        rootDraft: request.rootDraft,
        activeDialog: request.activeDialog,
        reason: request.reason,
        revision: request.revision
      }
  }
}

function toHostSubmitRequest(
  request: ExtensionSettingsSubmitRequest,
  registration: SettingsRegistration
): HostSettingsSubmitRequest {
  const base = {
    runtimeHandle: registration.owner.runtimeHandle,
    contributionId: registration.contribution.id,
    sessionId: request.sessionId
  }

  if (request.surface === 'root') {
    return {
      ...base,
      surface: 'root',
      draft: request.draft,
      revision: request.revision
    }
  }

  return {
    ...base,
    surface: 'dialog',
    dialogId: request.dialogId,
    draft: request.draft,
    parentDraft: request.parentDraft,
    revision: request.revision
  }
}

function toHostInvokeRequest(
  request: ExtensionSettingsInvokeRequest,
  registration: SettingsRegistration
): HostSettingsInvokeRequest {
  const base = {
    runtimeHandle: registration.owner.runtimeHandle,
    contributionId: registration.contribution.id,
    sessionId: request.sessionId,
    callbackId: request.callbackId,
    fieldId: request.fieldId,
    nodeId: request.nodeId,
    value: request.value,
    requestId: request.requestId,
    revision: request.revision
  }

  if (request.surface === 'root') {
    return {
      ...base,
      surface: 'root',
      draft: request.draft
    }
  }

  if (request.surface === 'dialog') {
    return {
      ...base,
      surface: 'dialog',
      dialogId: request.dialogId,
      draft: request.draft,
      parentDraft: request.parentDraft
    }
  }

  return {
    ...base,
    surface: 'popover',
    popoverId: request.popoverId,
    parent: request.parent,
    draft: request.draft,
    parentDraft: request.parentDraft
  }
}

function toHostReleaseRequest(
  request: ExtensionSettingsReleaseRequest,
  registration: SettingsRegistration
): HostSettingsReleaseRequest {
  const base = {
    runtimeHandle: registration.owner.runtimeHandle,
    contributionId: registration.contribution.id,
    sessionId: request.sessionId
  }

  switch (request.surface) {
    case 'root':
    case 'all':
      return {
        ...base,
        surface: request.surface
      }

    case 'dialog':
      return {
        ...base,
        surface: 'dialog',
        dialogId: request.dialogId
      }

    case 'popover':
      return {
        ...base,
        surface: 'popover',
        popoverId: request.popoverId,
        parent: request.parent
      }
  }
}

function toSettingsSession(
  extensionId: string,
  contributionId: string,
  sessionId: string
): ExtensionSettingsSession {
  return {
    sessionId,
    extensionId,
    contributionId
  }
}

function toResolvedRoot(payload: SettingsResolvedSurfacePayload): ExtensionResolvedSettingsRoot {
  return payload as unknown as ExtensionResolvedSettingsRoot
}

function toResolvedDialog(
  payload: SettingsResolvedSurfacePayload
): ExtensionResolvedSettingsDialog {
  return payload as unknown as ExtensionResolvedSettingsDialog
}

function toResolvedPopover(
  payload: SettingsResolvedSurfacePayload
): ExtensionResolvedSettingsPopover {
  return payload as unknown as ExtensionResolvedSettingsPopover
}

function createSettingsError(message: string, code?: string): SettingsCallbackResult {
  return {
    success: false,
    error: {
      code,
      message
    }
  }
}

function getPublicContributionKey(extensionId: string, contributionId: string): string {
  return `${extensionId}:${contributionId}`
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
