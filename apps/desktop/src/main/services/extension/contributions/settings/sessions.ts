import type { ExtensionRuntimeHandle } from '@kisaki/extension-api'
import type {
  ExtensionSettingsInvokeRequest,
  ExtensionSettingsParentRef,
  ExtensionSettingsRefreshRequest,
  ExtensionSettingsReleaseRequest,
  ExtensionSettingsSession,
  ExtensionSettingsSubmitRequest
} from '@shared/extension'
import type {
  MainSettingsSession,
  SettingsDialogLease,
  SettingsPopoverLease,
  SettingsRegistration,
  SettingsSurfaceLease
} from './types'
import { getSettingsSessionKey } from './utils'

export class SettingsSessionStore {
  private readonly sessions = new Map<string, MainSettingsSession>()

  set(session: MainSettingsSession): void {
    this.sessions.set(
      getSettingsSessionKey(session.extensionId, session.contributionId, session.sessionId),
      session
    )
  }

  clear(): void {
    this.sessions.clear()
  }

  requireForRegistration(
    request: ExtensionSettingsSession,
    registration: SettingsRegistration
  ): MainSettingsSession {
    const session = this.sessions.get(
      getSettingsSessionKey(request.extensionId, request.contributionId, request.sessionId)
    )
    if (!session) {
      throw new Error(`Settings session "${request.sessionId}" is no longer active.`)
    }

    if (session.runtimeHandle !== registration.owner.runtimeHandle) {
      this.sessions.delete(
        getSettingsSessionKey(request.extensionId, request.contributionId, request.sessionId)
      )
      throw new Error(`Settings session "${request.sessionId}" belongs to an inactive runtime.`)
    }

    return session
  }

  assertRegistrationMatchesSession(
    session: MainSettingsSession,
    registration: SettingsRegistration
  ): void {
    if (
      session.extensionId !== registration.owner.extension.id ||
      session.contributionId !== registration.contribution.id
    ) {
      throw new Error(`Settings session "${session.sessionId}" does not match the contribution.`)
    }
  }

  requireParentSurface(
    session: MainSettingsSession,
    parent: ExtensionSettingsParentRef
  ): SettingsSurfaceLease {
    if (parent.surface === 'root') {
      return session.root
    }

    if (session.activeDialog?.dialogId !== parent.dialogId) {
      throw new Error(`Settings dialog "${parent.dialogId}" is no longer active.`)
    }

    return session.activeDialog
  }

  assertRevision(surface: SettingsSurfaceLease, revision: number, label: string): void {
    if (surface.revision !== revision) {
      throw new Error(
        `Stale ${label} request: expected revision ${surface.revision}, received ${revision}.`
      )
    }
  }

  assertRefreshRequest(
    session: MainSettingsSession,
    request: ExtensionSettingsRefreshRequest
  ): void {
    switch (request.surface) {
      case 'root':
        this.assertRevision(session.root, request.revision, 'settings root')
        return

      case 'dialog':
        this.assertRevision(
          this.requireActiveDialog(session, request.dialogId),
          request.revision,
          'settings dialog'
        )
        return

      case 'popover':
        this.assertRevision(
          this.requireActivePopover(session, request.parent, request.popoverId),
          request.revision,
          'settings popover'
        )
        return

      case 'all':
        this.assertRevision(session.root, request.revision, 'settings root')
        if (request.activeDialog) {
          this.requireActiveDialog(session, request.activeDialog.dialogId)
        }
        return
    }
  }

  assertSubmitRequest(session: MainSettingsSession, request: ExtensionSettingsSubmitRequest): void {
    if (request.surface === 'root') {
      this.assertRevision(session.root, request.revision, 'settings root')
      return
    }

    this.assertRevision(
      this.requireActiveDialog(session, request.dialogId),
      request.revision,
      'settings dialog'
    )
  }

  assertInvokeRequest(session: MainSettingsSession, request: ExtensionSettingsInvokeRequest): void {
    if (request.surface === 'root') {
      this.assertRevision(session.root, request.revision, 'settings root')
      return
    }

    if (request.surface === 'dialog') {
      this.assertRevision(
        this.requireActiveDialog(session, request.dialogId),
        request.revision,
        'settings dialog'
      )
      return
    }

    this.assertRevision(
      this.requireActivePopover(session, request.parent, request.popoverId),
      request.revision,
      'settings popover'
    )
  }

  requireActiveDialog(session: MainSettingsSession, dialogId: string): SettingsDialogLease {
    if (session.activeDialog?.dialogId !== dialogId) {
      throw new Error(`Settings dialog "${dialogId}" is no longer active.`)
    }
    return session.activeDialog
  }

  requireActivePopover(
    session: MainSettingsSession,
    parent: ExtensionSettingsParentRef,
    popoverId: string
  ): SettingsPopoverLease {
    const popover = this.findActivePopover(session, parent)
    if (!popover || popover.popoverId !== popoverId) {
      throw new Error(`Settings popover "${popoverId}" is no longer active.`)
    }
    return popover
  }

  setActivePopover(session: MainSettingsSession, popover: SettingsPopoverLease): void {
    if (popover.parent.surface === 'root') {
      session.activeRootPopover = popover
    } else {
      session.activeDialogPopover = popover
    }
  }

  applyRelease(request: ExtensionSettingsReleaseRequest): void {
    const key = getSettingsSessionKey(
      request.extensionId,
      request.contributionId,
      request.sessionId
    )
    const session = this.sessions.get(key)
    if (!session) {
      return
    }

    switch (request.surface) {
      case 'root':
      case 'all':
        this.sessions.delete(key)
        return

      case 'dialog':
        if (session.activeDialog?.dialogId === request.dialogId) {
          session.activeDialog = undefined
          session.activeDialogPopover = undefined
        }
        return

      case 'popover':
        if (request.parent.surface === 'root') {
          if (session.activeRootPopover?.popoverId === request.popoverId) {
            session.activeRootPopover = undefined
          }
          return
        }

        if (
          session.activeDialogPopover?.popoverId === request.popoverId &&
          session.activeDialogPopover.parent.surface === 'dialog' &&
          session.activeDialogPopover.parent.dialogId === request.parent.dialogId
        ) {
          session.activeDialogPopover = undefined
        }
    }
  }

  clearContributionSessions(extensionId: string, contributionId: string): void {
    for (const [key, session] of [...this.sessions]) {
      if (session.extensionId === extensionId && session.contributionId === contributionId) {
        this.sessions.delete(key)
      }
    }
  }

  clearRuntimeSessions(runtimeHandle: ExtensionRuntimeHandle): void {
    for (const [key, session] of [...this.sessions]) {
      if (session.runtimeHandle === runtimeHandle) {
        this.sessions.delete(key)
      }
    }
  }

  private findActivePopover(
    session: MainSettingsSession,
    parent: ExtensionSettingsParentRef | unknown
  ): SettingsPopoverLease | undefined {
    if (!isSettingsParentRef(parent)) {
      return undefined
    }
    return parent.surface === 'root' ? session.activeRootPopover : session.activeDialogPopover
  }
}

function isSettingsParentRef(value: unknown): value is ExtensionSettingsParentRef {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const parent = value as { surface?: unknown; dialogId?: unknown }
  return (
    parent.surface === 'root' ||
    (parent.surface === 'dialog' && typeof parent.dialogId === 'string')
  )
}
