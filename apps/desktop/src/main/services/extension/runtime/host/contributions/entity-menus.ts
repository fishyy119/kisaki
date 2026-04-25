import { randomUUID } from 'node:crypto'
import {
  createUiError,
  type EntityMenuBuilder,
  type EntityMenuCallbackContext,
  type EntityMenuContribution,
  type EntityMenuInvokeRequest,
  type EntityMenuItem,
  type EntityMenuNode,
  type EntityMenuResolveInput,
  type EntityMenuResolveRequest,
  type EntityMenuResolveResult,
  type EntityMenuSessionReleaseRequest,
  type UiCallbackResult,
  validateEntityMenuContributionShape,
  validateEntityMenuItems,
  validateEntityMenuNodes
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

interface EntityMenuSession {
  runtimeHandle: string
  contributionId: string
  sessionId: string
  input: EntityMenuResolveInput
  callbacks: Map<string, EntityMenuCallbackRecord>
  ttlTimer: ReturnType<typeof setTimeout>
}

interface EntityMenuCallbackRecord {
  invoke(value: boolean | string | undefined, signal: AbortSignal): Promise<UiCallbackResult>
}

const SESSION_TTL_MS = 10 * 60 * 1000

/**
 * Host-side entity menu contribution domain.
 *
 * It keeps callback functions in the extension host and only exposes resolved,
 * serializable menu items to the main process.
 */
export class HostEntityMenuContributions {
  private readonly sessions = new Map<string, EntityMenuSession>()

  constructor(private readonly options: HostContributionDomainOptions) {}

  register(
    scope: HostContributionScope,
    contribution: EntityMenuContribution
  ): ContributionDisposable {
    const issues = validateEntityMenuContributionShape(contribution)
    if (issues.length > 0) {
      throwValidationIssues('Entity menu contribution', issues)
    }

    const runtime = requireRuntimeByScope(this.options.registry, scope)
    if (runtime.entityMenus.has(contribution.id)) {
      throw new Error(
        `Entity menu contribution "${contribution.id}" is already registered by "${scope.extensionId}".`
      )
    }

    this.options.registry.registerEntityMenu(scope.extensionId, contribution)
    this.options.trackMainRequest(
      scope,
      this.options.rpc.requestMain(
        'bridge.entityMenus.register',
        {
          runtimeHandle: scope.runtimeHandle,
          contribution: {
            id: contribution.id,
            target: contribution.target,
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
    contributionId: string,
    notifyMain: boolean
  ): Promise<void> {
    this.clearContributionSessions(scope.runtimeHandle, contributionId)
    this.options.registry.unregisterEntityMenu(scope.extensionId, contributionId)

    if (!notifyMain) {
      return
    }

    await this.options.rpc.requestMain(
      'bridge.entityMenus.unregister',
      {
        runtimeHandle: scope.runtimeHandle,
        contributionId
      },
      this.options.getCleanupRequestOptions(scope)
    )
  }

  async resolve(
    request: EntityMenuResolveRequest,
    signal: AbortSignal
  ): Promise<EntityMenuResolveResult> {
    const runtime = this.requireRuntimeForRequest(request.runtimeHandle)
    const contribution = runtime.entityMenus.get(request.contributionId)

    if (!contribution) {
      throw new Error(
        `Entity menu contribution "${request.contributionId}" is not registered for "${runtime.metadata.id}".`
      )
    }

    if (contribution.target !== request.input.target) {
      throw new Error(
        `Entity menu contribution "${contribution.id}" targets "${contribution.target}" but received "${request.input.target}".`
      )
    }

    const nodes = await this.options.runInExtensionContext(runtime, () =>
      contribution.resolve(request.input as never, createEntityMenuBuilder())
    )
    const nodeIssues = validateEntityMenuNodes(nodes)
    if (nodeIssues.length > 0) {
      throwValidationIssues('Resolved entity menu nodes', nodeIssues)
    }

    const session: EntityMenuSession = {
      runtimeHandle: request.runtimeHandle,
      contributionId: request.contributionId,
      sessionId: request.sessionId,
      input: request.input,
      callbacks: new Map(),
      ttlTimer: this.createSessionTimer(this.getSessionKey(request))
    }
    const items = normalizeEntityMenuNodes(runtime.metadata.id, contribution.id, nodes, session)
    const itemIssues = validateEntityMenuItems(items)
    if (itemIssues.length > 0) {
      throwValidationIssues('Resolved entity menu items', itemIssues)
    }

    this.storeSession(this.getSessionKey(request), session)
    signal.addEventListener(
      'abort',
      () => {
        this.deleteSession(this.getSessionKey(request))
      },
      { once: true }
    )

    return { items }
  }

  async invoke(request: EntityMenuInvokeRequest, signal: AbortSignal): Promise<UiCallbackResult> {
    const runtime = this.requireRuntimeForRequest(request.runtimeHandle)
    const sessionKey = this.getSessionKey(request)
    const session = this.sessions.get(sessionKey)
    if (!session) {
      return createUiError('Entity menu session is no longer active.', {
        code: 'unavailable',
        refresh: false
      })
    }

    const callback = session.callbacks.get(request.callbackId)
    if (!callback) {
      return createUiError('Entity menu callback is no longer active.', {
        code: 'not_found',
        refresh: false
      })
    }

    this.touchSession(sessionKey)
    return this.options.runInExtensionContext(runtime, () => callback.invoke(request.value, signal))
  }

  releaseSession(request: EntityMenuSessionReleaseRequest): void {
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

  private clearContributionSessions(runtimeHandle: string, contributionId: string): void {
    for (const [key, session] of [...this.sessions]) {
      if (session.runtimeHandle === runtimeHandle && session.contributionId === contributionId) {
        this.deleteSession(key)
      }
    }
  }

  private storeSession(key: string, session: EntityMenuSession): void {
    this.deleteSession(key)
    this.sessions.set(key, session)
  }

  private deleteSession(key: string): void {
    const session = this.sessions.get(key)
    if (!session) {
      return
    }

    clearTimeout(session.ttlTimer)
    this.sessions.delete(key)
  }

  private touchSession(key: string): void {
    const session = this.sessions.get(key)
    if (!session) {
      return
    }

    clearTimeout(session.ttlTimer)
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

function createEntityMenuBuilder(): EntityMenuBuilder {
  return {
    action: (node) => ({ ...node, kind: 'action' }),
    checkbox: (node) => ({ ...node, kind: 'checkbox' }),
    select: (node) => ({ ...node, kind: 'select' }),
    separator: (node) => ({ ...node, kind: 'separator' })
  }
}

function normalizeEntityMenuNodes(
  extensionId: string,
  contributionId: string,
  nodes: readonly EntityMenuNode[],
  session: EntityMenuSession
): readonly EntityMenuItem[] {
  return nodes.map((node) => {
    switch (node.kind) {
      case 'action': {
        const { onClick, ...item } = node
        if (!onClick) {
          return item
        }

        const callbackId = randomUUID()
        session.callbacks.set(callbackId, {
          invoke: (_value, signal) =>
            invokeUiCallback(
              extensionId,
              `Entity menu callback "${contributionId}:${node.id}"`,
              () => onClick(createCallbackContext(contributionId, session.input, signal))
            )
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
                createUiError('Checkbox menu callback requires a boolean value.', {
                  code: 'validation_failure'
                })
              )
            }

            return invokeUiCallback(
              extensionId,
              `Entity menu callback "${contributionId}:${node.id}"`,
              () => onChange(value, createCallbackContext(contributionId, session.input, signal))
            )
          }
        })

        return { ...item, callbackId }
      }

      case 'select': {
        const { onChange, ...item } = node
        if (!onChange) {
          return item
        }

        const callbackId = randomUUID()
        session.callbacks.set(callbackId, {
          invoke: (value, signal) => {
            if (typeof value !== 'string') {
              return Promise.resolve(
                createUiError('Select menu callback requires a string value.', {
                  code: 'validation_failure'
                })
              )
            }

            return invokeUiCallback(
              extensionId,
              `Entity menu callback "${contributionId}:${node.id}"`,
              () => onChange(value, createCallbackContext(contributionId, session.input, signal))
            )
          }
        })

        return { ...item, callbackId }
      }

      case 'separator':
        return node
    }
  })
}

function createCallbackContext(
  contributionId: string,
  input: EntityMenuResolveInput,
  signal: AbortSignal
): EntityMenuCallbackContext {
  return {
    contributionId,
    input,
    signal
  }
}
