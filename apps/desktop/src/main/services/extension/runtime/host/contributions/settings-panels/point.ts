import {
  type SettingsPanelCallbackResponse,
  type SettingsPanelContribution,
  type SettingsPanelDialogDefinition,
  type SettingsPanelDialogSubmitEvent,
  type SettingsPanelInvokeRequest,
  type SettingsPanelOpenRequest,
  type SettingsPanelOpenResponse,
  type SettingsPanelParentRef,
  type SettingsPanelPopoverDefinition,
  type SettingsPanelRefreshRequest,
  type SettingsPanelRefreshResponse,
  type SettingsPanelRegistration,
  type SettingsPanelReleaseRequest,
  type SettingsPanelResolvedSurfacePayload,
  type SettingsPanelRootSubmitEvent,
  type SettingsPanelSubmitRequest,
  validateSettingsPanelContributionShape,
  validateSettingsPanelDialogModel,
  validateSettingsPanelDialogSubmitResult,
  validateSettingsPanelPopoverModel,
  validateSettingsPanelRootModel,
  validateSettingsPanelRootSubmitResult
} from '@kisaki/extension-api'
import { requireRuntimeByScope, throwValidationIssues } from '../utils'
import type { HostContributionDomainOptions, HostContributionScope } from '../types'
import { createContributionRegistration } from '../registration'
import { invokeSettingsPanelCallback } from './callbacks'
import {
  createDialogContext,
  createDialogSubmitHelpers,
  createPopoverContext,
  createRootContext,
  createRootSubmitHelpers
} from './context'
import { createSettingsPanelNodeFactory } from './factory'
import {
  normalizeSettingsPanelDialogModel,
  normalizeSettingsPanelPopoverModel,
  normalizeSettingsPanelRootModel
} from './normalize'
import {
  EMPTY_DRAFT,
  SESSION_TTL_MS,
  type LoadedRuntime,
  type ResolveSettingsPanelDialogOptions,
  type ResolveSettingsPanelPopoverOptions,
  type ResolveSettingsPanelRootOptions,
  type SettingsPanelSession,
  type SettingsPanelSurfaceSession
} from './types'
import { createSettingsPanelError, parentsEqual, toParams } from './values'

/**
 * Host-side settings contribution domain.
 *
 * It owns root/dialog/popover sessions and callback maps while returning only
 * serializable field/node DTOs to the main process.
 */
export class HostSettingsPanelContributionPoint {
  private readonly sessions = new Map<string, SettingsPanelSession>()

  constructor(private readonly options: HostContributionDomainOptions) {}

  register(
    scope: HostContributionScope,
    contribution: SettingsPanelContribution<any, any>
  ): SettingsPanelRegistration {
    const issues = validateSettingsPanelContributionShape(contribution)
    if (issues.length > 0) {
      throwValidationIssues('Settings panel contribution', issues)
    }

    const runtime = requireRuntimeByScope(this.options.registry, scope)
    if (runtime.settingsPanels.has(contribution.id)) {
      throw new Error(
        `Settings panel contribution "${contribution.id}" is already registered by "${scope.extensionId}".`
      )
    }

    this.options.registry.registerSettingsPanel(scope.extensionId, contribution)
    const request = this.options.rpc.requestMain(
      'contributions.settingsPanels.register',
      {
        runtimeHandle: scope.runtimeHandle,
        panel: {
          id: contribution.id,
          title: contribution.title,
          description: contribution.description,
          order: contribution.order
        }
      },
      this.options.getRequestOptions(scope)
    )

    const registration = createContributionRegistration({
      scope,
      label: `Settings panel contribution "${contribution.id}"`,
      mainRegistration: request,
      reportDiagnostic: (diagnostic) => this.options.reportDiagnostic(scope, diagnostic),
      disposeLocal: () => {
        this.clearContributionSessions(scope.runtimeHandle, contribution.id)
        this.options.registry.unregisterSettingsPanel(scope.extensionId, contribution.id)
      },
      unregisterMain: () =>
        this.options.rpc.requestMain(
          'contributions.settingsPanels.unregister',
          {
            runtimeHandle: scope.runtimeHandle,
            contributionId: contribution.id
          },
          this.options.getCleanupRequestOptions(scope)
        ),
      invalidateLocal: () => {
        this.clearContributionSessions(scope.runtimeHandle, contribution.id)
        this.options.registry.unregisterSettingsPanel(scope.extensionId, contribution.id)
      },
      onSyncFailure: (error) => {
        runtime.context.logger.error(
          `Settings panel contribution "${contribution.id}" was disabled because main registry synchronization failed.`,
          error
        )
      }
    })
    this.options.trackMainRequest(scope, registration.sync)

    return {
      dispose: () => registration.dispose(),
      refresh: async (reason) => {
        registration.assertActive('refresh')

        await this.options.rpc.requestMain(
          'contributions.settingsPanels.refreshRequested',
          {
            runtimeHandle: scope.runtimeHandle,
            contributionId: contribution.id,
            reason
          },
          this.options.getRequestOptions(scope)
        )
      }
    }
  }

  async open(
    request: SettingsPanelOpenRequest,
    signal: AbortSignal
  ): Promise<SettingsPanelOpenResponse> {
    const runtime = this.requireRuntimeForRequest(request.runtimeHandle)
    const contribution = this.requireContribution(runtime, request.contributionId)

    if (request.surface === 'root') {
      const session: SettingsPanelSession = {
        runtimeHandle: request.runtimeHandle,
        contributionId: request.contributionId,
        sessionId: request.sessionId,
        ttlTimer: null
      }
      const sessionKey = this.getSessionKey(request)
      this.storeSession(sessionKey, session)
      signal.addEventListener(
        'abort',
        () => {
          this.deleteSession(sessionKey)
        },
        { once: true }
      )

      try {
        const view = await this.resolveRoot({
          runtime,
          contribution,
          session,
          draft: EMPTY_DRAFT,
          reason: request.reason,
          signal
        })
        return { surface: 'root', sessionId: request.sessionId, view }
      } catch (error) {
        this.deleteSession(sessionKey)
        throw error
      }
    }

    const session = this.requireSession(request)
    this.touchSession(this.getSessionKey(request))

    if (request.surface === 'dialog') {
      session.activeRootPopover = undefined
      session.activeDialogPopover = undefined
      const dialog = await this.resolveDialog({
        runtime,
        contribution,
        session,
        dialogId: request.dialogId,
        params: toParams(request.params),
        draft: EMPTY_DRAFT,
        parentDraft: request.parentDraft,
        signal
      })
      return { surface: 'dialog', dialog }
    }

    this.requireActiveParentSurface(session, request.parent)
    const popover = await this.resolvePopover({
      runtime,
      contribution,
      session,
      popoverId: request.popoverId,
      parent: request.parent,
      params: toParams(request.params),
      draft: EMPTY_DRAFT,
      parentDraft: request.parentDraft,
      anchorNodeKey: request.anchorNodeKey,
      signal
    })
    return { surface: 'popover', popover }
  }

  async refresh(
    request: SettingsPanelRefreshRequest,
    signal: AbortSignal
  ): Promise<SettingsPanelRefreshResponse> {
    const runtime = this.requireRuntimeForRequest(request.runtimeHandle)
    const contribution = this.requireContribution(runtime, request.contributionId)
    const session = this.requireSession(request)
    this.touchSession(this.getSessionKey(request))

    if (request.surface === 'root') {
      session.activeRootPopover = undefined
      const view = await this.resolveRoot({
        runtime,
        contribution,
        session,
        draft: request.draft,
        reason: request.reason,
        signal
      })
      return { surface: 'root', sessionId: request.sessionId, view }
    }

    if (request.surface === 'dialog') {
      const activeDialog = this.requireActiveDialog(session, request.dialogId)
      session.activeDialogPopover = undefined
      const dialog = await this.resolveDialog({
        runtime,
        contribution,
        session,
        dialogId: request.dialogId,
        params: activeDialog.params,
        draft: request.draft,
        parentDraft: request.parentDraft,
        reason: request.reason,
        signal
      })
      return { surface: 'dialog', dialog }
    }

    if (request.surface === 'popover') {
      const activePopover = this.requireActivePopover(session, request.parent, request.popoverId)
      const popover = await this.resolvePopover({
        runtime,
        contribution,
        session,
        popoverId: request.popoverId,
        parent: request.parent,
        params: activePopover.params,
        draft: request.draft,
        parentDraft: request.parentDraft,
        anchorNodeKey: activePopover.anchorNodeKey,
        reason: request.reason,
        signal
      })
      return { surface: 'popover', popover }
    }

    session.activeRootPopover = undefined
    session.activeDialogPopover = undefined
    const view = await this.resolveRoot({
      runtime,
      contribution,
      session,
      draft: request.rootDraft,
      reason: request.reason,
      signal
    })

    let activeDialog:
      | {
          dialogId: string
          dialog: SettingsPanelResolvedSurfacePayload
        }
      | undefined

    if (request.activeDialog && session.activeDialog?.dialogId === request.activeDialog.dialogId) {
      const dialog = await this.resolveDialog({
        runtime,
        contribution,
        session,
        dialogId: request.activeDialog.dialogId,
        params: session.activeDialog.params,
        draft: request.activeDialog.draft,
        parentDraft: request.rootDraft,
        reason: request.reason,
        signal
      })
      activeDialog = {
        dialogId: request.activeDialog.dialogId,
        dialog
      }
    }

    return { surface: 'all', sessionId: request.sessionId, view, activeDialog }
  }

  async submit(
    request: SettingsPanelSubmitRequest,
    signal: AbortSignal
  ): Promise<SettingsPanelCallbackResponse> {
    const runtime = this.requireRuntimeForRequest(request.runtimeHandle)
    const contribution = this.requireContribution(runtime, request.contributionId)
    const session = this.requireSession(request)
    this.touchSession(this.getSessionKey(request))

    if (request.surface === 'root') {
      if (!contribution.submit) {
        return { result: { success: true } }
      }

      const event = {
        ...createRootContext(request.contributionId, request.sessionId, request.draft, signal),
        ...createRootSubmitHelpers()
      } as SettingsPanelRootSubmitEvent
      const result = await this.options.runInExtensionContext(runtime, () =>
        invokeSettingsPanelCallback(
          runtime.metadata.id,
          `Settings submit "${contribution.id}:root"`,
          () => contribution.submit!(event),
          validateSettingsPanelRootSubmitResult
        )
      )
      return { result }
    }

    const activeDialog = this.requireActiveDialog(session, request.dialogId)
    const definition = this.requireDialogDefinition(contribution, request.dialogId)
    if (!definition.submit) {
      return { result: { success: true } }
    }

    const event = {
      ...createDialogContext(
        request.contributionId,
        request.sessionId,
        request.dialogId,
        activeDialog.params,
        request.draft,
        request.parentDraft,
        signal
      ),
      ...createDialogSubmitHelpers()
    } as SettingsPanelDialogSubmitEvent
    const result = await this.options.runInExtensionContext(runtime, () =>
      invokeSettingsPanelCallback(
        runtime.metadata.id,
        `Settings submit "${contribution.id}:${request.dialogId}"`,
        () => definition.submit!(event),
        validateSettingsPanelDialogSubmitResult
      )
    )
    return { result }
  }

  async invoke(
    request: SettingsPanelInvokeRequest,
    signal: AbortSignal
  ): Promise<SettingsPanelCallbackResponse> {
    const runtime = this.requireRuntimeForRequest(request.runtimeHandle)
    const session = this.requireSession(request)
    const surface = this.requireSurfaceForInvoke(session, request)
    const callback = surface.callbacks.get(request.callbackId)

    if (!callback) {
      return {
        result: createSettingsPanelError('Settings callback is no longer active.', 'not_found')
      }
    }

    this.touchSession(this.getSessionKey(request))
    const result = await this.options.runInExtensionContext(runtime, () =>
      callback.invoke(request, signal)
    )
    return { result }
  }

  release(request: SettingsPanelReleaseRequest): void {
    const session = this.sessions.get(this.getSessionKey(request))
    if (!session) {
      return
    }

    switch (request.surface) {
      case 'root':
      case 'all':
        this.deleteSession(this.getSessionKey(request))
        return

      case 'dialog':
        if (session.activeDialog?.dialogId === request.dialogId) {
          session.activeDialog = undefined
          session.activeDialogPopover = undefined
        }
        this.touchSession(this.getSessionKey(request))
        return

      case 'popover':
        if (request.parent.surface === 'root') {
          if (session.activeRootPopover?.popoverId === request.popoverId) {
            session.activeRootPopover = undefined
          }
        } else {
          const activeDialogPopover = session.activeDialogPopover
          if (
            activeDialogPopover?.popoverId === request.popoverId &&
            activeDialogPopover.parent?.surface === 'dialog' &&
            activeDialogPopover.parent.dialogId === request.parent.dialogId
          ) {
            session.activeDialogPopover = undefined
          }
        }
        this.touchSession(this.getSessionKey(request))
    }
  }

  releaseRuntime(runtimeHandle: string): void {
    for (const [key, session] of [...this.sessions]) {
      if (session.runtimeHandle === runtimeHandle) {
        this.deleteSession(key)
      }
    }
  }

  releaseAll(): void {
    for (const key of [...this.sessions.keys()]) {
      this.deleteSession(key)
    }
  }

  private requireRuntimeForRequest(runtimeHandle: string) {
    const runtime = this.options.registry.getByRuntimeHandle(runtimeHandle)
    if (!runtime) {
      throw new Error(`Extension runtime "${runtimeHandle}" is not active.`)
    }
    return runtime
  }

  private requireContribution(
    runtime: LoadedRuntime,
    contributionId: string
  ): SettingsPanelContribution<any, any> {
    const contribution = runtime.settingsPanels.get(contributionId)
    if (!contribution) {
      throw new Error(
        `Settings panel contribution "${contributionId}" is not registered for "${runtime.metadata.id}".`
      )
    }
    return contribution
  }

  private requireSession(request: {
    runtimeHandle: string
    contributionId: string
    sessionId: string
  }): SettingsPanelSession {
    const session = this.sessions.get(this.getSessionKey(request))
    if (!session) {
      throw new Error(`Settings session "${request.sessionId}" is no longer active.`)
    }
    return session
  }

  private requireActiveDialog(
    session: SettingsPanelSession,
    dialogId: string
  ): SettingsPanelSurfaceSession {
    if (!session.activeDialog || session.activeDialog.dialogId !== dialogId) {
      throw new Error(`Settings dialog "${dialogId}" is no longer active.`)
    }
    return session.activeDialog
  }

  private requireActivePopover(
    session: SettingsPanelSession,
    parent: SettingsPanelParentRef,
    popoverId: string
  ): SettingsPanelSurfaceSession {
    const active =
      parent.surface === 'root' ? session.activeRootPopover : session.activeDialogPopover

    if (!active || active.popoverId !== popoverId || !parentsEqual(active.parent, parent)) {
      throw new Error(`Settings popover "${popoverId}" is no longer active.`)
    }

    return active
  }

  private requireDialogDefinition(
    contribution: SettingsPanelContribution<any, any>,
    dialogId: string
  ): SettingsPanelDialogDefinition {
    const definition = contribution.dialogs?.[dialogId]
    if (!definition) {
      throw new Error(`Settings dialog "${dialogId}" is not registered for "${contribution.id}".`)
    }
    return definition
  }

  private requirePopoverDefinition(
    contribution: SettingsPanelContribution<any, any>,
    popoverId: string
  ): SettingsPanelPopoverDefinition {
    const definition = contribution.popovers?.[popoverId]
    if (!definition) {
      throw new Error(`Settings popover "${popoverId}" is not registered for "${contribution.id}".`)
    }
    return definition
  }

  private requireSurfaceForInvoke(
    session: SettingsPanelSession,
    request: SettingsPanelInvokeRequest
  ): SettingsPanelSurfaceSession {
    if (request.surface === 'root') {
      if (!session.root) {
        throw new Error('Settings root is no longer active.')
      }
      return session.root
    }

    if (request.surface === 'dialog') {
      return this.requireActiveDialog(session, request.dialogId)
    }

    return this.requireActivePopover(session, request.parent, request.popoverId)
  }

  private requireActiveParentSurface(
    session: SettingsPanelSession,
    parent: SettingsPanelParentRef
  ): SettingsPanelSurfaceSession {
    if (parent.surface === 'root') {
      if (!session.root) {
        throw new Error('Settings root is no longer active.')
      }
      return session.root
    }

    return this.requireActiveDialog(session, parent.dialogId)
  }

  private async resolveRoot(
    options: ResolveSettingsPanelRootOptions
  ): Promise<SettingsPanelResolvedSurfacePayload> {
    const surface: SettingsPanelSurfaceSession = {
      surface: 'root',
      params: {},
      callbacks: new Map()
    }
    const context = createRootContext(
      options.contribution.id,
      options.session.sessionId,
      options.draft,
      options.signal,
      options.reason
    )
    const model = await this.options.runInExtensionContext(options.runtime, () =>
      options.contribution.resolve(context, createSettingsPanelNodeFactory())
    )
    const modelIssues = validateSettingsPanelRootModel(model)
    if (modelIssues.length > 0) {
      throwValidationIssues('Resolved settings root', modelIssues)
    }

    const payload = normalizeSettingsPanelRootModel(model, {
      extensionId: options.runtime.metadata.id,
      contribution: options.contribution,
      session: options.session,
      surface
    })
    options.session.root = surface
    return payload
  }

  private async resolveDialog(
    options: ResolveSettingsPanelDialogOptions
  ): Promise<SettingsPanelResolvedSurfacePayload> {
    const definition = this.requireDialogDefinition(options.contribution, options.dialogId)
    const surface: SettingsPanelSurfaceSession = {
      surface: 'dialog',
      dialogId: options.dialogId,
      params: options.params,
      callbacks: new Map()
    }
    const context = createDialogContext(
      options.contribution.id,
      options.session.sessionId,
      options.dialogId,
      options.params,
      options.draft,
      options.parentDraft,
      options.signal,
      options.reason
    )
    const model = await this.options.runInExtensionContext(options.runtime, () =>
      definition.resolve(context, createSettingsPanelNodeFactory())
    )
    const modelIssues = validateSettingsPanelDialogModel(model)
    if (modelIssues.length > 0) {
      throwValidationIssues('Resolved settings dialog', modelIssues)
    }

    const payload = normalizeSettingsPanelDialogModel(model, {
      extensionId: options.runtime.metadata.id,
      contribution: options.contribution,
      session: options.session,
      surface
    })
    options.session.activeDialog = surface
    return payload
  }

  private async resolvePopover(
    options: ResolveSettingsPanelPopoverOptions
  ): Promise<SettingsPanelResolvedSurfacePayload> {
    const definition = this.requirePopoverDefinition(options.contribution, options.popoverId)
    const surface: SettingsPanelSurfaceSession = {
      surface: 'popover',
      popoverId: options.popoverId,
      parent: options.parent,
      anchorNodeKey: options.anchorNodeKey,
      params: options.params,
      callbacks: new Map()
    }
    const context = createPopoverContext(
      options.contribution.id,
      options.session.sessionId,
      options.popoverId,
      options.parent,
      options.params,
      options.draft,
      options.parentDraft,
      options.signal,
      options.reason
    )
    const model = await this.options.runInExtensionContext(options.runtime, () =>
      definition.resolve(context, createSettingsPanelNodeFactory())
    )
    const modelIssues = validateSettingsPanelPopoverModel(model)
    if (modelIssues.length > 0) {
      throwValidationIssues('Resolved settings popover', modelIssues)
    }

    const payload = normalizeSettingsPanelPopoverModel(model, {
      extensionId: options.runtime.metadata.id,
      contribution: options.contribution,
      session: options.session,
      surface,
      anchorNodeKey: options.anchorNodeKey
    })

    if (options.parent.surface === 'root') {
      options.session.activeRootPopover = surface
    } else {
      options.session.activeDialogPopover = surface
    }
    return payload
  }

  private clearContributionSessions(runtimeHandle: string, contributionId: string): void {
    for (const [key, session] of [...this.sessions]) {
      if (session.runtimeHandle === runtimeHandle && session.contributionId === contributionId) {
        this.deleteSession(key)
      }
    }
  }

  private storeSession(key: string, session: SettingsPanelSession): void {
    this.deleteSession(key)
    session.ttlTimer = this.createSessionTimer(key)
    this.sessions.set(key, session)
  }

  private deleteSession(key: string): void {
    const session = this.sessions.get(key)
    if (!session) {
      return
    }

    if (session.ttlTimer) {
      clearTimeout(session.ttlTimer)
    }
    this.sessions.delete(key)
  }

  private touchSession(key: string): void {
    const session = this.sessions.get(key)
    if (!session) {
      return
    }

    if (session.ttlTimer) {
      clearTimeout(session.ttlTimer)
    }
    session.ttlTimer = this.createSessionTimer(key)
  }

  private createSessionTimer(key: string): ReturnType<typeof setTimeout> {
    const timer = setTimeout(() => {
      this.sessions.delete(key)
    }, SESSION_TTL_MS)
    if (typeof timer === 'object' && 'unref' in timer) {
      timer.unref()
    }
    return timer
  }

  private getSessionKey(request: {
    runtimeHandle: string
    contributionId: string
    sessionId: string
  }): string {
    return `${request.runtimeHandle}:${request.contributionId}:${request.sessionId}`
  }
}
