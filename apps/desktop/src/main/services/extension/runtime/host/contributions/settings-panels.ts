import { randomUUID } from 'node:crypto'
import {
  createUiError,
  type SerializableValue,
  type SettingsPanelBuilder,
  type SettingsPanelCallbackContext,
  type SettingsPanelContribution,
  type SettingsPanelControlNode,
  type SettingsPanelInvokeRequest,
  type SettingsPanelNode,
  type SettingsPanelResolvedControlNode,
  type SettingsPanelResolvedNode,
  type SettingsPanelResolveRequest,
  type SettingsPanelResolveResult,
  type SettingsPanelSubmitRequest,
  type SettingsSubmitEvent,
  type UiCallbackResult,
  validateSettingsPanelContributionShape,
  validateSettingsPanelNodes,
  validateSettingsPanelResolvedNodes
} from '@kisaki/extension-api'
import {
  createContributionDisposable,
  requireRuntimeByScope,
  throwValidationIssues,
  type ContributionDisposable,
  type HostContributionDomainOptions,
  type HostContributionScope
} from './types'
import { invokeUiCallback } from './ui'

interface SettingsPanelSession {
  runtimeHandle: string
  panelId: string
  sessionId: string
  callbacks: Map<string, SettingsPanelCallbackRecord>
}

interface SettingsPanelCallbackRecord {
  invoke(value: SerializableValue | undefined, signal: AbortSignal): Promise<UiCallbackResult>
}

/**
 * Host-side settings panel contribution domain.
 *
 * It owns panel sessions and control callbacks while returning only structured
 * settings nodes to the main process.
 */
export class HostSettingsPanelContributions {
  private readonly sessions = new Map<string, SettingsPanelSession>()

  constructor(private readonly options: HostContributionDomainOptions) {}

  register(
    scope: HostContributionScope,
    contribution: SettingsPanelContribution
  ): ContributionDisposable {
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
    this.options.trackMainRequest(
      scope,
      this.options.rpc.requestMain(
        'bridge.settingsPanels.register',
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

    return createContributionDisposable(async () => {
      await this.unregister(scope, contribution.id, true)
    })
  }

  async unregister(
    scope: HostContributionScope,
    panelId: string,
    notifyMain: boolean
  ): Promise<void> {
    this.clearPanelSessions(scope.runtimeHandle, panelId)
    this.options.registry.unregisterSettingsPanel(scope.extensionId, panelId)

    if (!notifyMain) {
      return
    }

    await this.options.rpc.requestMain(
      'bridge.settingsPanels.unregister',
      {
        runtimeHandle: scope.runtimeHandle,
        panelId
      },
      this.options.getCleanupRequestOptions(scope)
    )
  }

  async resolve(
    request: SettingsPanelResolveRequest,
    signal: AbortSignal
  ): Promise<SettingsPanelResolveResult> {
    const runtime = this.requireRuntimeForRequest(request.runtimeHandle)
    const panel = runtime.settingsPanels.get(request.panelId)

    if (!panel) {
      throw new Error(
        `Settings panel "${request.panelId}" is not registered for "${runtime.metadata.id}".`
      )
    }

    const nodes = await this.options.runInExtensionContext(runtime, () =>
      panel.resolve(createSettingsPanelBuilder())
    )
    const nodeIssues = validateSettingsPanelNodes(nodes)
    if (nodeIssues.length > 0) {
      throwValidationIssues('Resolved settings panel nodes', nodeIssues)
    }

    const session: SettingsPanelSession = {
      runtimeHandle: request.runtimeHandle,
      panelId: request.panelId,
      sessionId: request.sessionId,
      callbacks: new Map()
    }
    const resolvedNodes = normalizeSettingsPanelNodes(runtime.metadata.id, panel.id, nodes, session)
    const resolvedIssues = validateSettingsPanelResolvedNodes(resolvedNodes)
    if (resolvedIssues.length > 0) {
      throwValidationIssues('Resolved settings panel model', resolvedIssues)
    }

    this.sessions.set(this.getSessionKey(request), session)
    signal.addEventListener(
      'abort',
      () => {
        this.sessions.delete(this.getSessionKey(request))
      },
      { once: true }
    )

    return { nodes: resolvedNodes }
  }

  async submit(
    request: SettingsPanelSubmitRequest,
    signal: AbortSignal
  ): Promise<UiCallbackResult> {
    const runtime = this.requireRuntimeForRequest(request.runtimeHandle)
    if (!this.sessions.has(this.getSessionKey(request))) {
      return createUiError('Settings panel session is no longer active.', {
        code: 'unavailable'
      })
    }

    const panel = runtime.settingsPanels.get(request.panelId)

    if (!panel) {
      return createUiError('Settings panel is no longer active.', {
        code: 'unavailable'
      })
    }

    if (!panel.onSubmit) {
      return { success: true, refresh: false }
    }

    const event: SettingsSubmitEvent = {
      panelId: request.panelId,
      values: request.values,
      signal
    }

    return this.options.runInExtensionContext(runtime, () =>
      invokeUiCallback(runtime.metadata.id, `Settings panel submit "${panel.id}"`, () =>
        panel.onSubmit!(event)
      )
    )
  }

  async invoke(
    request: SettingsPanelInvokeRequest,
    signal: AbortSignal
  ): Promise<UiCallbackResult> {
    const runtime = this.requireRuntimeForRequest(request.runtimeHandle)
    const session = this.sessions.get(this.getSessionKey(request))
    if (!session) {
      return createUiError('Settings panel session is no longer active.', {
        code: 'unavailable'
      })
    }

    const callback = session.callbacks.get(request.callbackId)
    if (!callback) {
      return createUiError('Settings panel callback is no longer active.', {
        code: 'not_found'
      })
    }

    return this.options.runInExtensionContext(runtime, () => callback.invoke(request.value, signal))
  }

  releaseRuntime(runtimeHandle: string): void {
    for (const [key, session] of this.sessions) {
      if (session.runtimeHandle === runtimeHandle) {
        this.sessions.delete(key)
      }
    }
  }

  releaseAll(): void {
    this.sessions.clear()
  }

  private requireRuntimeForRequest(runtimeHandle: string) {
    const runtime = this.options.registry.getByRuntimeHandle(runtimeHandle)
    if (!runtime) {
      throw new Error(`Extension runtime "${runtimeHandle}" is not active.`)
    }
    return runtime
  }

  private clearPanelSessions(runtimeHandle: string, panelId: string): void {
    for (const [key, session] of this.sessions) {
      if (session.runtimeHandle === runtimeHandle && session.panelId === panelId) {
        this.sessions.delete(key)
      }
    }
  }

  private getSessionKey(request: {
    runtimeHandle: string
    panelId: string
    sessionId: string
  }): string {
    return `${request.runtimeHandle}:${request.panelId}:${request.sessionId}`
  }
}

function createSettingsPanelBuilder(): SettingsPanelBuilder {
  return {
    section: (node) => ({ ...node, kind: 'section' }),
    text: (node) => ({ ...node, kind: 'text' }),
    switch: (node) => ({ ...node, kind: 'switch' }),
    checkbox: (node) => ({ ...node, kind: 'checkbox' }),
    select: (node) => ({ ...node, kind: 'select' }),
    textInput: (node) => ({ ...node, kind: 'textInput' }),
    textarea: (node) => ({ ...node, kind: 'textarea' }),
    numberInput: (node) => ({ ...node, kind: 'numberInput' }),
    button: (node) => ({ ...node, kind: 'button' }),
    notice: (node) => ({ ...node, kind: 'notice' }),
    status: (node) => ({ ...node, kind: 'status' }),
    divider: (node) => ({ ...node, kind: 'divider' })
  }
}

function normalizeSettingsPanelNodes(
  extensionId: string,
  panelId: string,
  nodes: readonly SettingsPanelNode[],
  session: SettingsPanelSession
): readonly SettingsPanelResolvedNode[] {
  return nodes.map((node) => {
    if (node.kind === 'section') {
      return {
        ...node,
        controls: node.controls.map((control) =>
          normalizeSettingsPanelControl(extensionId, panelId, control, session)
        )
      }
    }

    return node
  })
}

function normalizeSettingsPanelControl(
  extensionId: string,
  panelId: string,
  node: SettingsPanelControlNode,
  session: SettingsPanelSession
): SettingsPanelResolvedControlNode {
  switch (node.kind) {
    case 'switch': {
      const { onChange, ...item } = node
      if (!onChange) {
        return item
      }

      const callbackId = randomUUID()
      session.callbacks.set(callbackId, {
        invoke: (value, signal) => {
          if (typeof value !== 'boolean') {
            return Promise.resolve(
              createUiError('Switch callback requires a boolean value.', {
                code: 'validation_failure'
              })
            )
          }

          return invokeUiCallback(
            extensionId,
            `Settings panel callback "${panelId}:${node.id}"`,
            () => onChange(value, createCallbackContext(panelId, signal))
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
      session.callbacks.set(callbackId, {
        invoke: (value, signal) => {
          if (typeof value !== 'boolean') {
            return Promise.resolve(
              createUiError('Checkbox callback requires a boolean value.', {
                code: 'validation_failure'
              })
            )
          }

          return invokeUiCallback(
            extensionId,
            `Settings panel callback "${panelId}:${node.id}"`,
            () => onChange(value, createCallbackContext(panelId, signal))
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
      session.callbacks.set(callbackId, {
        invoke: (value, signal) => {
          if (typeof value !== 'string') {
            return Promise.resolve(
              createUiError('Text settings callback requires a string value.', {
                code: 'validation_failure'
              })
            )
          }

          return invokeUiCallback(
            extensionId,
            `Settings panel callback "${panelId}:${node.id}"`,
            () => onChange(value, createCallbackContext(panelId, signal))
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
      session.callbacks.set(callbackId, {
        invoke: (value, signal) => {
          if (typeof value !== 'number') {
            return Promise.resolve(
              createUiError('Number input callback requires a number value.', {
                code: 'validation_failure'
              })
            )
          }

          return invokeUiCallback(
            extensionId,
            `Settings panel callback "${panelId}:${node.id}"`,
            () => onChange(value, createCallbackContext(panelId, signal))
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
      session.callbacks.set(callbackId, {
        invoke: (_value, signal) =>
          invokeUiCallback(extensionId, `Settings panel callback "${panelId}:${node.id}"`, () =>
            onClick(undefined, createCallbackContext(panelId, signal))
          )
      })

      return { ...item, callbackId }
    }

    case 'text':
    case 'notice':
    case 'status':
    case 'divider':
      return node
  }
}

function createCallbackContext(panelId: string, signal: AbortSignal): SettingsPanelCallbackContext {
  return {
    panelId,
    signal
  }
}
