import { randomUUID } from 'node:crypto'
import {
  readErrorCode,
  readErrorDetails,
  type SerializableRecord,
  type SerializableValue,
  type SettingsBuilder,
  type SettingsCallbackContext,
  type SettingsContribution,
  type SettingsDialogTarget,
  type SettingsFrameContext,
  type SettingsFrameInvokeRequest,
  type SettingsFrameOpenRequest,
  type SettingsFrameRefreshRequest,
  type SettingsFrameReleaseRequest,
  type SettingsFrameResult,
  type SettingsInteractionResponse,
  type SettingsInteractionResult,
  type SettingsNode,
  type SettingsResolvedNode,
  type SettingsSessionOpenRequest,
  type SettingsSessionReleaseRequest,
  type SettingsSubmitEvent,
  type SettingsFrameSubmitRequest,
  validateSettingsContributionShape,
  validateSettingsInteractionResult,
  validateSettingsResolvedScreenModel,
  validateSettingsScreenModel
} from '@kisaki/extension-api'
import {
  createContributionDisposable,
  throwValidationIssues,
  type ContributionDisposable,
  type HostContributionDomainOptions,
  type HostContributionScope
} from './types'
import { formatValidationIssues } from './types'

interface SettingsSession {
  runtimeHandle: string
  contributionId: string
  sessionId: string
  frames: Map<string, SettingsFrameSession>
  ttlTimer: ReturnType<typeof setTimeout> | null
}

interface SettingsFrameSession {
  frameId: string
  screenId: string
  params: Record<string, SerializableValue>
  callbacks: Map<string, SettingsCallbackRecord>
}

interface SettingsCallbackRecord {
  invoke(
    value: SerializableValue | undefined,
    signal: AbortSignal
  ): Promise<SettingsInteractionResult>
}

const SESSION_TTL_MS = 10 * 60 * 1000

/**
 * Host-side settings contribution domain.
 *
 * It owns settings sessions, dialog frames, and per-frame callbacks while
 * returning only serializable screen DTOs to the main process.
 */
export class HostSettingsContributions {
  private readonly sessions = new Map<string, SettingsSession>()

  constructor(private readonly options: HostContributionDomainOptions) {}

  register(
    scope: HostContributionScope,
    contribution: SettingsContribution
  ): ContributionDisposable {
    const issues = validateSettingsContributionShape(contribution)
    if (issues.length > 0) {
      throwValidationIssues('Settings contribution', issues)
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
            order: contribution.order,
            rootScreenId: contribution.rootScreenId
          }
        },
        this.options.getRequestOptions(scope)
      )
    )

    return createContributionDisposable(async () => {
      await this.unregister(scope, contribution.id, true)
    })
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

  async open(
    request: SettingsSessionOpenRequest,
    signal: AbortSignal
  ): Promise<SettingsFrameResult> {
    const runtime = this.requireRuntimeForRequest(request.runtimeHandle)
    const contribution = this.requireContribution(runtime, request.contributionId)
    const key = this.getSessionKey(request)
    const session: SettingsSession = {
      runtimeHandle: request.runtimeHandle,
      contributionId: request.contributionId,
      sessionId: request.sessionId,
      frames: new Map(),
      ttlTimer: null
    }

    this.storeSession(key, session)
    signal.addEventListener(
      'abort',
      () => {
        this.deleteSession(key)
      },
      { once: true }
    )

    return this.resolveFrame({
      runtime,
      contribution,
      session,
      frameId: randomUUID(),
      target: {
        screenId: contribution.rootScreenId,
        params: {}
      },
      signal
    })
  }

  async openFrame(
    request: SettingsFrameOpenRequest,
    signal: AbortSignal
  ): Promise<SettingsFrameResult> {
    const runtime = this.requireRuntimeForRequest(request.runtimeHandle)
    const contribution = this.requireContribution(runtime, request.contributionId)
    const session = this.requireSession(request)
    this.touchSession(this.getSessionKey(request))

    return this.resolveFrame({
      runtime,
      contribution,
      session,
      frameId: randomUUID(),
      target: request.target,
      signal
    })
  }

  async refreshFrame(
    request: SettingsFrameRefreshRequest,
    signal: AbortSignal
  ): Promise<SettingsFrameResult> {
    const runtime = this.requireRuntimeForRequest(request.runtimeHandle)
    const contribution = this.requireContribution(runtime, request.contributionId)
    const session = this.requireSession(request)
    const frame = session.frames.get(request.frameId)
    if (!frame) {
      throw new Error(`Settings frame "${request.frameId}" is no longer active.`)
    }

    this.touchSession(this.getSessionKey(request))
    return this.resolveFrame({
      runtime,
      contribution,
      session,
      frameId: frame.frameId,
      target: {
        screenId: frame.screenId,
        params: frame.params
      },
      signal
    })
  }

  async submit(
    request: SettingsFrameSubmitRequest,
    signal: AbortSignal
  ): Promise<SettingsInteractionResponse> {
    const runtime = this.requireRuntimeForRequest(request.runtimeHandle)
    const contribution = runtime.settings.get(request.contributionId)
    const session = this.sessions.get(this.getSessionKey(request))
    const frame = session?.frames.get(request.frameId)

    if (!contribution || !session || !frame) {
      return { result: createSettingsError('Settings frame is no longer active.', 'unavailable') }
    }

    const screen = contribution.screens[frame.screenId]
    if (!screen) {
      return { result: createSettingsError('Settings screen is no longer active.', 'unavailable') }
    }

    if (!screen.submit) {
      return { result: { success: true } }
    }

    const event: SettingsSubmitEvent = {
      ...createFrameContext(request.contributionId, frame, signal),
      values: request.values
    }

    this.touchSession(this.getSessionKey(request))
    return {
      result: await this.options.runInExtensionContext(runtime, () =>
        invokeSettingsCallback(runtime.metadata.id, `Settings submit "${contribution.id}"`, () =>
          screen.submit!(event)
        )
      )
    }
  }

  async invoke(
    request: SettingsFrameInvokeRequest,
    signal: AbortSignal
  ): Promise<SettingsInteractionResponse> {
    const runtime = this.requireRuntimeForRequest(request.runtimeHandle)
    const session = this.sessions.get(this.getSessionKey(request))
    const frame = session?.frames.get(request.frameId)
    if (!session || !frame) {
      return { result: createSettingsError('Settings frame is no longer active.', 'unavailable') }
    }

    const callback = frame.callbacks.get(request.callbackId)
    if (!callback) {
      return { result: createSettingsError('Settings callback is no longer active.', 'not_found') }
    }

    this.touchSession(this.getSessionKey(request))
    return {
      result: await this.options.runInExtensionContext(runtime, () =>
        callback.invoke(request.value, signal)
      )
    }
  }

  releaseFrame(request: SettingsFrameReleaseRequest): void {
    const session = this.sessions.get(this.getSessionKey(request))
    if (!session) {
      return
    }

    session.frames.delete(request.frameId)
    this.touchSession(this.getSessionKey(request))
  }

  releaseSession(request: SettingsSessionReleaseRequest): void {
    this.deleteSession(this.getSessionKey(request))
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
    runtime: ReturnType<HostSettingsContributions['requireRuntimeForRequest']>,
    contributionId: string
  ): SettingsContribution {
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

  private async resolveFrame(options: {
    runtime: ReturnType<HostSettingsContributions['requireRuntimeForRequest']>
    contribution: SettingsContribution
    session: SettingsSession
    frameId: string
    target: SettingsDialogTarget
    signal: AbortSignal
  }): Promise<SettingsFrameResult> {
    const screen = options.contribution.screens[options.target.screenId]
    if (!screen) {
      throw new Error(
        `Settings screen "${options.target.screenId}" is not registered for "${options.contribution.id}".`
      )
    }

    const params = options.target.params ?? {}
    const frame: SettingsFrameSession = {
      frameId: options.frameId,
      screenId: options.target.screenId,
      params,
      callbacks: new Map()
    }
    const context = createFrameContext(options.contribution.id, frame, options.signal)
    const screenModel = await this.options.runInExtensionContext(options.runtime, () =>
      screen.resolve(context, createSettingsBuilder())
    )
    const modelIssues = validateSettingsScreenModel(screenModel)
    if (modelIssues.length > 0) {
      throwValidationIssues('Resolved settings screen', modelIssues)
    }

    const resolvedScreen = {
      ...screenModel,
      nodes: screenModel.nodes.map((node) =>
        normalizeSettingsNode(options.runtime.metadata.id, options.contribution.id, frame, node)
      )
    }
    const resolvedIssues = validateSettingsResolvedScreenModel(resolvedScreen)
    if (resolvedIssues.length > 0) {
      throwValidationIssues('Resolved settings screen model', resolvedIssues)
    }

    options.session.frames.set(frame.frameId, frame)

    return {
      frameId: frame.frameId,
      screenId: frame.screenId,
      params: frame.params,
      screen: resolvedScreen
    }
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

function createSettingsBuilder(): SettingsBuilder {
  return {
    screen: (model) => model,
    section: (node) => ({ ...node, kind: 'section' }),
    text: (node) => ({ ...node, kind: 'text' }),
    switch: (node) => ({ ...node, kind: 'switch' }),
    checkbox: (node) => ({ ...node, kind: 'checkbox' }),
    select: (node) => ({ ...node, kind: 'select' }),
    textInput: (node) => ({ ...node, kind: 'textInput' }),
    textarea: (node) => ({ ...node, kind: 'textarea' }),
    numberInput: (node) => ({ ...node, kind: 'numberInput' }),
    button: (node) => ({ ...node, kind: 'button' }),
    dialog: (node) => ({ ...node, kind: 'dialog' }),
    notice: (node) => ({ ...node, kind: 'notice' }),
    status: (node) => ({ ...node, kind: 'status' }),
    divider: (node) => ({ ...node, kind: 'divider' })
  }
}

function normalizeSettingsNode(
  extensionId: string,
  contributionId: string,
  frame: SettingsFrameSession,
  node: SettingsNode
): SettingsResolvedNode {
  switch (node.kind) {
    case 'section':
      return {
        ...node,
        children: node.children.map((child) =>
          normalizeSettingsNode(extensionId, contributionId, frame, child)
        )
      }

    case 'switch': {
      const { onChange, ...item } = node
      if (!onChange) {
        return item
      }

      const callbackId = randomUUID()
      frame.callbacks.set(callbackId, {
        invoke: (value, signal) => {
          if (typeof value !== 'boolean') {
            return Promise.resolve(
              createSettingsError('Switch callback requires a boolean value.', 'validation_failure')
            )
          }

          return invokeSettingsCallback(
            extensionId,
            `Settings callback "${contributionId}:${frame.screenId}:${node.id}"`,
            () => onChange(value, createCallbackContext(contributionId, frame, node.id, signal))
          )
        }
      })

      return { ...item, callbackId }
    }

    case 'checkbox': {
      const { onChange, ...item } = node
      if (!onChange) {
        return item
      }

      const callbackId = randomUUID()
      frame.callbacks.set(callbackId, {
        invoke: (value, signal) => {
          if (typeof value !== 'boolean') {
            return Promise.resolve(
              createSettingsError(
                'Checkbox callback requires a boolean value.',
                'validation_failure'
              )
            )
          }

          return invokeSettingsCallback(
            extensionId,
            `Settings callback "${contributionId}:${frame.screenId}:${node.id}"`,
            () => onChange(value, createCallbackContext(contributionId, frame, node.id, signal))
          )
        }
      })

      return { ...item, callbackId }
    }

    case 'select':
    case 'textInput':
    case 'textarea': {
      const { onChange, ...item } = node
      if (!onChange) {
        return item
      }

      const callbackId = randomUUID()
      frame.callbacks.set(callbackId, {
        invoke: (value, signal) => {
          if (typeof value !== 'string') {
            return Promise.resolve(
              createSettingsError('Text callback requires a string value.', 'validation_failure')
            )
          }

          return invokeSettingsCallback(
            extensionId,
            `Settings callback "${contributionId}:${frame.screenId}:${node.id}"`,
            () => onChange(value, createCallbackContext(contributionId, frame, node.id, signal))
          )
        }
      })

      return { ...item, callbackId }
    }

    case 'numberInput': {
      const { onChange, ...item } = node
      if (!onChange) {
        return item
      }

      const callbackId = randomUUID()
      frame.callbacks.set(callbackId, {
        invoke: (value, signal) => {
          if (typeof value !== 'number') {
            return Promise.resolve(
              createSettingsError(
                'Number input callback requires a number value.',
                'validation_failure'
              )
            )
          }

          return invokeSettingsCallback(
            extensionId,
            `Settings callback "${contributionId}:${frame.screenId}:${node.id}"`,
            () => onChange(value, createCallbackContext(contributionId, frame, node.id, signal))
          )
        }
      })

      return { ...item, callbackId }
    }

    case 'button': {
      const { onClick, ...item } = node
      if (!onClick) {
        return item
      }

      const callbackId = randomUUID()
      frame.callbacks.set(callbackId, {
        invoke: (_value, signal) =>
          invokeSettingsCallback(
            extensionId,
            `Settings callback "${contributionId}:${frame.screenId}:${node.id}"`,
            () => onClick(undefined, createCallbackContext(contributionId, frame, node.id, signal))
          )
      })

      return { ...item, callbackId }
    }

    case 'dialog':
    case 'divider':
    case 'notice':
    case 'status':
    case 'text':
      return node
  }
}

function createFrameContext(
  contributionId: string,
  frame: SettingsFrameSession,
  signal: AbortSignal
): SettingsFrameContext {
  return {
    contributionId,
    screenId: frame.screenId,
    frameId: frame.frameId,
    params: frame.params,
    signal
  }
}

function createCallbackContext(
  contributionId: string,
  frame: SettingsFrameSession,
  nodeId: string,
  signal: AbortSignal
): SettingsCallbackContext {
  return {
    ...createFrameContext(contributionId, frame, signal),
    nodeId
  }
}

async function invokeSettingsCallback(
  extensionId: string,
  label: string,
  callback: () => Promise<SettingsInteractionResult> | SettingsInteractionResult
): Promise<SettingsInteractionResult> {
  try {
    const result = await callback()
    const issues = validateSettingsInteractionResult(result)
    if (issues.length > 0) {
      console.warn(
        `[ExtensionHost][${extensionId}] ${label} returned an invalid SettingsInteractionResult:\n${formatValidationIssues(
          issues
        )}`
      )
      return createSettingsError(
        'Extension settings callback returned an invalid result.',
        'validation_failure',
        {
          issues: issues.map((issue) => ({
            path: issue.path,
            message: issue.message
          }))
        }
      )
    }

    return result
  } catch (error) {
    console.warn(`[ExtensionHost][${extensionId}] ${label} failed:`, error)
    return createSettingsError(
      error instanceof Error ? error.message : 'Extension settings callback failed.',
      readErrorCode(error) ?? 'internal',
      readErrorDetails(error)
    )
  }
}

function createSettingsError(
  message: string,
  code?: string,
  details?: SerializableRecord
): SettingsInteractionResult {
  return {
    success: false,
    error: {
      code,
      message,
      details
    }
  }
}
