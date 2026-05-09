import type {
  SettingsInvokeRequest as HostSettingsInvokeRequest,
  SettingsOpenRequest as HostSettingsOpenRequest,
  SettingsRefreshRequest as HostSettingsRefreshRequest,
  SettingsReleaseRequest as HostSettingsReleaseRequest,
  SettingsResolvedSurfacePayload,
  SettingsSubmitRequest as HostSettingsSubmitRequest
} from '@kisaki/extension-api'
import type {
  ExtensionResolvedSettingsDialog,
  ExtensionResolvedSettingsPopover,
  ExtensionResolvedSettingsRoot,
  ExtensionSettingsContributionInfo,
  ExtensionSettingsInvokeRequest,
  ExtensionSettingsOpenRequest,
  ExtensionSettingsRefreshRequest,
  ExtensionSettingsReleaseRequest,
  ExtensionSettingsSession,
  ExtensionSettingsSubmitRequest
} from '@shared/extension'
import { toContributionOwnerInfo } from '../types'
import type { SettingsRegistration } from './types'

export function toSettingsContributionInfo(
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

export function toHostOpenRequest(
  request: ExtensionSettingsOpenRequest,
  registration: SettingsRegistration,
  sessionId?: string
): HostSettingsOpenRequest {
  if (request.surface === 'root') {
    if (!sessionId) {
      throw new Error('Settings root open requests require a main-owned session id.')
    }

    return {
      runtimeHandle: registration.owner.runtimeHandle,
      contributionId: registration.contribution.id,
      surface: 'root',
      sessionId,
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

export function toHostRefreshRequest(
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

export function toHostSubmitRequest(
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

export function toHostInvokeRequest(
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

export function toHostReleaseRequest(
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

export function toSettingsSession(
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

export function toResolvedRoot(
  payload: SettingsResolvedSurfacePayload
): ExtensionResolvedSettingsRoot {
  return payload as unknown as ExtensionResolvedSettingsRoot
}

export function toResolvedDialog(
  payload: SettingsResolvedSurfacePayload
): ExtensionResolvedSettingsDialog {
  return payload as unknown as ExtensionResolvedSettingsDialog
}

export function toResolvedPopover(
  payload: SettingsResolvedSurfacePayload
): ExtensionResolvedSettingsPopover {
  return payload as unknown as ExtensionResolvedSettingsPopover
}
