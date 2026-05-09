import {
  type SettingsCallbackResponse,
  type SettingsContribution,
  type SettingsDialogDefinition,
  type SettingsDialogSubmitEvent,
  type SettingsInvokeRequest,
  type SettingsOpenRequest,
  type SettingsOpenResult,
  type SettingsParentRef,
  type SettingsPopoverDefinition,
  type SettingsRefreshRequest,
  type SettingsRefreshResult,
  type SettingsRegistration,
  type SettingsReleaseRequest,
  type SettingsResolvedSurfacePayload,
  type SettingsRootSubmitEvent,
  type SettingsSubmitRequest,
  validateSettingsContributionShape,
  validateSettingsDialogModel,
  validateSettingsDialogSubmitResult,
  validateSettingsPopoverModel,
  validateSettingsRootModel,
  validateSettingsRootSubmitResult
} from '@kisaki/extension-api'
import {
  requireRuntimeByScope,
  throwValidationIssues,
  type HostContributionDomainOptions,
  type HostContributionScope
} from '../types'
import { invokeSettingsCallback } from './callbacks'
import {
  createDialogContext,
  createDialogSubmitHelpers,
  createPopoverContext,
  createRootContext,
  createRootSubmitHelpers
} from './context'
import { createSettingsNodeFactory } from './factory'
import { normalizeDialogModel, normalizePopoverModel, normalizeRootModel } from './normalize'
import {
  EMPTY_DRAFT,
  SESSION_TTL_MS,
  type LoadedRuntime,
  type ResolveDialogOptions,
  type ResolvePopoverOptions,
  type ResolveRootOptions,
  type SettingsSession,
  type SettingsSurfaceSession
} from './types'
import { createSettingsError, parentsEqual, toParams } from './values'

/**
 * Host-side settings contribution domain.
 *
 * It owns root/dialog/popover sessions and callback maps while returning only
 * serializable field/node DTOs to the main process.
 */
export class HostSettingsContributions {
  private readonly sessions = new Map<string, SettingsSession>()

  constructor(private readonly options: HostContributionDomainOptions) {}

  register(
    scope: HostContributionScope,
    contribution: SettingsContribution<any, any>
  ): SettingsRegistration {
    const issues = validateSettingsContributionShape(contribution)
    if (issues.length > 0) {
      throwValidationIssues('Settings contribution', issues)
    }

    const runtime = requireRuntimeByScope(this.options.registry, scope)
    if (runtime.settings.has(contribution.id)) {
      throw new Error(
        `Settings contribution "${contribution.id}" is already registered by "${scope.extensionId}".`
      )
    }

    this.options.registry.registerSettings(scope.extensionId, contribution)
    this.options.trackMainRequest(
      scope,
      this.options.rpc.requestMain(
        'contributions.settings.register',
        {
          runtimeHandle: scope.runtimeHandle,
          contribution: {
            id: contribution.id,
            title: contribution.title,
            description: contribution.description,
            order: contribution.order
          }
        },
        this.options.getRequestOptions(scope)
      )
    )

    let disposed = false
    return {
      dispose: async () => {
        if (disposed) {
          return
        }

        disposed = true
        await this.unregister(scope, contribution.id, true)
      },
      refresh: async (reason) => {
        if (disposed) {
          throw new Error(`Settings contribution "${contribution.id}" has already been disposed.`)
        }

        await this.options.rpc.requestMain(
          'contributions.settings.refreshRequested',
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

  async unregister(
    scope: HostContributionScope,
    contributionId: string,
    notifyMain: boolean
  ): Promise<void> {
    this.clearContributionSessions(scope.runtimeHandle, contributionId)
    this.options.registry.unregisterSettings(scope.extensionId, contributionId)

    if (!notifyMain) {
      return
    }

    await this.options.rpc.requestMain(
      'contributions.settings.unregister',
      {
        runtimeHandle: scope.runtimeHandle,
        contributionId
      },
      this.options.getCleanupRequestOptions(scope)
    )
  }

  async open(request: SettingsOpenRequest, signal: AbortSignal): Promise<SettingsOpenResult> {
    const runtime = this.requireRuntimeForRequest(request.runtimeHandle)
    const contribution = this.requireContribution(runtime, request.contributionId)

    if (request.surface === 'root') {
      const session: SettingsSession = {
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
    request: SettingsRefreshRequest,
    signal: AbortSignal
  ): Promise<SettingsRefreshResult> {
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
          dialog: SettingsResolvedSurfacePayload
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
    request: SettingsSubmitRequest,
    signal: AbortSignal
  ): Promise<SettingsCallbackResponse> {
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
      } as SettingsRootSubmitEvent
      const result = await this.options.runInExtensionContext(runtime, () =>
        invokeSettingsCallback(
          runtime.metadata.id,
          `Settings submit "${contribution.id}:root"`,
          () => contribution.submit!(event),
          validateSettingsRootSubmitResult
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
    } as SettingsDialogSubmitEvent
    const result = await this.options.runInExtensionContext(runtime, () =>
      invokeSettingsCallback(
        runtime.metadata.id,
        `Settings submit "${contribution.id}:${request.dialogId}"`,
        () => definition.submit!(event),
        validateSettingsDialogSubmitResult
      )
    )
    return { result }
  }

  async invoke(
    request: SettingsInvokeRequest,
    signal: AbortSignal
  ): Promise<SettingsCallbackResponse> {
    const runtime = this.requireRuntimeForRequest(request.runtimeHandle)
    const session = this.requireSession(request)
    const surface = this.requireSurfaceForInvoke(session, request)
    const callback = surface.callbacks.get(request.callbackId)

    if (!callback) {
      return { result: createSettingsError('Settings callback is no longer active.', 'not_found') }
    }

    this.touchSession(this.getSessionKey(request))
    const result = await this.options.runInExtensionContext(runtime, () =>
      callback.invoke(request, signal)
    )
    return { result }
  }

  release(request: SettingsReleaseRequest): void {
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
  ): SettingsContribution<any, any> {
    const contribution = runtime.settings.get(contributionId)
    if (!contribution) {
      throw new Error(
        `Settings contribution "${contributionId}" is not registered for "${runtime.metadata.id}".`
      )
    }
    return contribution
  }

  private requireSession(request: {
    runtimeHandle: string
    contributionId: string
    sessionId: string
  }): SettingsSession {
    const session = this.sessions.get(this.getSessionKey(request))
    if (!session) {
      throw new Error(`Settings session "${request.sessionId}" is no longer active.`)
    }
    return session
  }

  private requireActiveDialog(session: SettingsSession, dialogId: string): SettingsSurfaceSession {
    if (!session.activeDialog || session.activeDialog.dialogId !== dialogId) {
      throw new Error(`Settings dialog "${dialogId}" is no longer active.`)
    }
    return session.activeDialog
  }

  private requireActivePopover(
    session: SettingsSession,
    parent: SettingsParentRef,
    popoverId: string
  ): SettingsSurfaceSession {
    const active =
      parent.surface === 'root' ? session.activeRootPopover : session.activeDialogPopover

    if (!active || active.popoverId !== popoverId || !parentsEqual(active.parent, parent)) {
      throw new Error(`Settings popover "${popoverId}" is no longer active.`)
    }

    return active
  }

  private requireDialogDefinition(
    contribution: SettingsContribution<any, any>,
    dialogId: string
  ): SettingsDialogDefinition {
    const definition = contribution.dialogs?.[dialogId]
    if (!definition) {
      throw new Error(`Settings dialog "${dialogId}" is not registered for "${contribution.id}".`)
    }
    return definition
  }

  private requirePopoverDefinition(
    contribution: SettingsContribution<any, any>,
    popoverId: string
  ): SettingsPopoverDefinition {
    const definition = contribution.popovers?.[popoverId]
    if (!definition) {
      throw new Error(`Settings popover "${popoverId}" is not registered for "${contribution.id}".`)
    }
    return definition
  }

  private requireSurfaceForInvoke(
    session: SettingsSession,
    request: SettingsInvokeRequest
  ): SettingsSurfaceSession {
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
    session: SettingsSession,
    parent: SettingsParentRef
  ): SettingsSurfaceSession {
    if (parent.surface === 'root') {
      if (!session.root) {
        throw new Error('Settings root is no longer active.')
      }
      return session.root
    }

    return this.requireActiveDialog(session, parent.dialogId)
  }

  private async resolveRoot(options: ResolveRootOptions): Promise<SettingsResolvedSurfacePayload> {
    const surface: SettingsSurfaceSession = {
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
      options.contribution.resolve(context, createSettingsNodeFactory())
    )
    const modelIssues = validateSettingsRootModel(model)
    if (modelIssues.length > 0) {
      throwValidationIssues('Resolved settings root', modelIssues)
    }

    const payload = normalizeRootModel(model, {
      extensionId: options.runtime.metadata.id,
      contribution: options.contribution,
      session: options.session,
      surface
    })
    options.session.root = surface
    return payload
  }

  private async resolveDialog(
    options: ResolveDialogOptions
  ): Promise<SettingsResolvedSurfacePayload> {
    const definition = this.requireDialogDefinition(options.contribution, options.dialogId)
    const surface: SettingsSurfaceSession = {
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
      definition.resolve(context, createSettingsNodeFactory())
    )
    const modelIssues = validateSettingsDialogModel(model)
    if (modelIssues.length > 0) {
      throwValidationIssues('Resolved settings dialog', modelIssues)
    }

    const payload = normalizeDialogModel(model, {
      extensionId: options.runtime.metadata.id,
      contribution: options.contribution,
      session: options.session,
      surface
    })
    options.session.activeDialog = surface
    return payload
  }

  private async resolvePopover(
    options: ResolvePopoverOptions
  ): Promise<SettingsResolvedSurfacePayload> {
    const definition = this.requirePopoverDefinition(options.contribution, options.popoverId)
    const surface: SettingsSurfaceSession = {
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
      definition.resolve(context, createSettingsNodeFactory())
    )
    const modelIssues = validateSettingsPopoverModel(model)
    if (modelIssues.length > 0) {
      throwValidationIssues('Resolved settings popover', modelIssues)
    }

    const payload = normalizePopoverModel(model, {
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

  private storeSession(key: string, session: SettingsSession): void {
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
