import {
  createUiError,
  type MenuContribution,
  type MenuContributionRegistration,
  type MenuDomain,
  type MenuInput,
  type MenuInputFor,
  type MenuInvokeRequest,
  type MenuNode,
  type MenuNodeEvent,
  type MenuNodeFactory,
  type MenuRegistration,
  type MenuReleaseRequest,
  type MenuResolveRequest,
  type MenuResolveResult,
  type MenuScope,
  type UiCallbackResult,
  validateMenuContributionShape,
  validateMenuNodes
} from '@kisaki/extension-api'
import {
  requireRuntimeByScope,
  throwValidationIssues,
  type HostContributionDomainOptions,
  type HostContributionScope
} from './types'
import { invokeUiCallback } from './ui'
import { toSerializableRecord } from '../sdk-bridge/utils/serialization'
import type { RegisteredMenuContribution } from '../extension-registry'

interface MenuSession {
  runtimeHandle: string
  contributionId: string
  sessionId: string
  input: MenuInput
  callbacks: Map<string, MenuCallbackRecord>
  ttlTimer: ReturnType<typeof setTimeout> | null
}

interface MenuCallbackRecord {
  nodeId: string
  nodePath: readonly string[]
  invoke(value: boolean | string | undefined, signal: AbortSignal): Promise<UiCallbackResult>
}

const SESSION_TTL_MS = 10 * 60 * 1000

/**
 * Host-side menu contribution domain.
 *
 * It keeps callback functions in the extension host and only exposes resolved,
 * serializable menu nodes to the main process.
 */
export class HostMenuContributions {
  private readonly sessions = new Map<string, MenuSession>()

  constructor(private readonly options: HostContributionDomainOptions) {}

  register<TDomain extends MenuDomain, TScope extends MenuScope<TDomain>>(
    scope: HostContributionScope,
    domain: TDomain,
    menuScope: TScope,
    contribution: MenuContribution<MenuInputFor<TDomain, TScope>>
  ): MenuRegistration {
    const issues = validateMenuContributionShape(contribution)
    if (issues.length > 0) {
      throwValidationIssues('Menu contribution', issues)
    }

    const runtime = requireRuntimeByScope(this.options.registry, scope)
    if (runtime.menus.has(contribution.id)) {
      throw new Error(
        `Menu contribution "${contribution.id}" is already registered by "${scope.extensionId}".`
      )
    }

    this.options.registry.registerMenu(scope.extensionId, {
      id: contribution.id,
      domain,
      scope: menuScope,
      order: contribution.order,
      contribution
    })
    this.options.trackMainRequest(
      scope,
      this.options.rpc.requestMain(
        'contributions.menus.register',
        {
          runtimeHandle: scope.runtimeHandle,
          contribution: createMenuContributionRegistration(
            contribution.id,
            domain,
            menuScope,
            contribution.order
          )
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
          throw new Error(`Menu contribution "${contribution.id}" has already been disposed.`)
        }

        await this.options.rpc.requestMain(
          'contributions.menus.refreshRequested',
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
    this.options.registry.unregisterMenu(scope.extensionId, contributionId)

    if (!notifyMain) {
      return
    }

    await this.options.rpc.requestMain(
      'contributions.menus.unregister',
      {
        runtimeHandle: scope.runtimeHandle,
        contributionId
      },
      this.options.getCleanupRequestOptions(scope)
    )
  }

  async resolve(request: MenuResolveRequest, signal: AbortSignal): Promise<MenuResolveResult> {
    const runtime = this.requireRuntimeForRequest(request.runtimeHandle)
    const registration = runtime.menus.get(request.contributionId)

    if (!registration) {
      throw new Error(
        `Menu contribution "${request.contributionId}" is not registered for "${runtime.metadata.id}".`
      )
    }

    if (
      registration.domain !== request.input.domain ||
      registration.scope !== request.input.scope
    ) {
      throw new Error(
        `Menu contribution "${registration.id}" targets "${registration.domain}.${registration.scope}" but received "${request.input.domain}.${request.input.scope}".`
      )
    }

    const nodes = await this.options.runInExtensionContext(runtime, () =>
      resolveRegisteredMenuContribution(registration, request.input)
    )
    const nodeIssues = validateMenuNodes(nodes)
    if (nodeIssues.length > 0) {
      throwValidationIssues('Resolved menu nodes', nodeIssues)
    }

    const session: MenuSession = {
      runtimeHandle: request.runtimeHandle,
      contributionId: request.contributionId,
      sessionId: request.sessionId,
      input: request.input,
      callbacks: new Map(),
      ttlTimer: null
    }
    const normalizedNodes = normalizeMenuNodes(runtime.metadata.id, registration.id, nodes, session)
    const serializableNodes = normalizedNodes.map((node, index) =>
      toSerializableRecord(node, `resolved menu node ${index}`)
    )

    const sessionKey = getSessionKey(
      request.runtimeHandle,
      request.contributionId,
      request.sessionId
    )
    this.storeSession(sessionKey, session)
    signal.addEventListener(
      'abort',
      () => {
        this.deleteSession(sessionKey)
      },
      { once: true }
    )

    return { nodes: serializableNodes }
  }

  async invoke(request: MenuInvokeRequest, signal: AbortSignal): Promise<UiCallbackResult> {
    const runtime = this.requireRuntimeForRequest(request.runtimeHandle)
    const sessionKey = getSessionKey(
      request.runtimeHandle,
      request.contributionId,
      request.sessionId
    )
    const session = this.sessions.get(sessionKey)
    if (!session || session.runtimeHandle !== request.runtimeHandle) {
      return createUiError('Menu session is no longer active.', {
        code: 'unavailable',
        refresh: false
      })
    }

    const callback = session.callbacks.get(getNodePathKey(request.nodePath))
    if (!callback) {
      return createUiError('Menu callback is no longer active.', {
        code: 'not_found',
        refresh: false
      })
    }

    this.touchSession(sessionKey)
    return this.options.runInExtensionContext(runtime, () => callback.invoke(request.value, signal))
  }

  release(request: MenuReleaseRequest): void {
    for (const [sessionKey, session] of [...this.sessions]) {
      if (session.sessionId === request.sessionId) {
        this.deleteSession(sessionKey)
      }
    }
  }

  releaseRuntime(runtimeHandle: string): void {
    for (const [sessionKey, session] of [...this.sessions]) {
      if (session.runtimeHandle === runtimeHandle) {
        this.deleteSession(sessionKey)
      }
    }
  }

  releaseAll(): void {
    for (const sessionKey of [...this.sessions.keys()]) {
      this.deleteSession(sessionKey)
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
    for (const [sessionKey, session] of [...this.sessions]) {
      if (session.runtimeHandle === runtimeHandle && session.contributionId === contributionId) {
        this.deleteSession(sessionKey)
      }
    }
  }

  private storeSession(sessionKey: string, session: MenuSession): void {
    this.deleteSession(sessionKey)
    session.ttlTimer = this.createSessionTimer(sessionKey)
    this.sessions.set(sessionKey, session)
  }

  private deleteSession(sessionKey: string): void {
    const session = this.sessions.get(sessionKey)
    if (!session) {
      return
    }

    if (session.ttlTimer) {
      clearTimeout(session.ttlTimer)
    }
    this.sessions.delete(sessionKey)
  }

  private touchSession(sessionKey: string): void {
    const session = this.sessions.get(sessionKey)
    if (!session) {
      return
    }

    if (session.ttlTimer) {
      clearTimeout(session.ttlTimer)
    }
    session.ttlTimer = this.createSessionTimer(sessionKey)
  }

  private createSessionTimer(sessionKey: string): ReturnType<typeof setTimeout> {
    const timer = setTimeout(() => {
      this.sessions.delete(sessionKey)
    }, SESSION_TTL_MS)
    if (typeof timer === 'object' && 'unref' in timer) {
      timer.unref()
    }
    return timer
  }
}

function createMenuNodeFactory<TInput extends MenuInput>(): MenuNodeFactory<TInput> {
  return {
    action: (node) => ({ ...node, kind: 'action' }),
    checkbox: (node) => ({ ...node, kind: 'checkbox' }),
    select: (node) => ({ ...node, kind: 'select' }),
    submenu: (node) => ({ ...node, kind: 'submenu' }),
    separator: (node = {}) => ({ ...node, kind: 'separator' })
  }
}

function createMenuContributionRegistration<
  TDomain extends MenuDomain,
  TScope extends MenuScope<TDomain>
>(
  id: string,
  domain: TDomain,
  scope: TScope,
  order: number | undefined
): MenuContributionRegistration {
  return { id, domain, scope, order } as MenuContributionRegistration
}

function resolveRegisteredMenuContribution(
  registration: RegisteredMenuContribution,
  input: MenuInput
) {
  switch (registration.domain) {
    case 'game':
      if (registration.scope === 'single' && input.domain === 'game' && input.scope === 'single') {
        return registration.contribution.resolve(input, createMenuNodeFactory<typeof input>())
      }
      if (registration.scope === 'batch' && input.domain === 'game' && input.scope === 'batch') {
        return registration.contribution.resolve(input, createMenuNodeFactory<typeof input>())
      }
      break

    case 'character':
      if (
        registration.scope === 'single' &&
        input.domain === 'character' &&
        input.scope === 'single'
      ) {
        return registration.contribution.resolve(input, createMenuNodeFactory<typeof input>())
      }
      break

    case 'person':
      if (
        registration.scope === 'single' &&
        input.domain === 'person' &&
        input.scope === 'single'
      ) {
        return registration.contribution.resolve(input, createMenuNodeFactory<typeof input>())
      }
      break

    case 'company':
      if (
        registration.scope === 'single' &&
        input.domain === 'company' &&
        input.scope === 'single'
      ) {
        return registration.contribution.resolve(input, createMenuNodeFactory<typeof input>())
      }
      break

    case 'collection':
      if (
        registration.scope === 'single' &&
        input.domain === 'collection' &&
        input.scope === 'single'
      ) {
        return registration.contribution.resolve(input, createMenuNodeFactory<typeof input>())
      }
      break

    case 'tag':
      if (registration.scope === 'single' && input.domain === 'tag' && input.scope === 'single') {
        return registration.contribution.resolve(input, createMenuNodeFactory<typeof input>())
      }
      break
  }

  throw new Error(
    `Menu contribution "${registration.id}" cannot resolve input "${input.domain}.${input.scope}".`
  )
}

function normalizeMenuNodes(
  extensionId: string,
  contributionId: string,
  nodes: readonly MenuNode[],
  session: MenuSession,
  parentPath: readonly string[] = []
): readonly Record<string, unknown>[] {
  const normalized: Record<string, unknown>[] = []
  const usedNodeIds = collectExplicitMenuNodeIds(nodes)

  for (const [index, node] of nodes.entries()) {
    if (node.hidden === true) {
      continue
    }

    const nodeId = getMenuNodeId(node, index, usedNodeIds)
    usedNodeIds.add(nodeId)
    const nodePath = [...parentPath, nodeId]

    if (node.kind === 'separator') {
      if (normalized.length === 0 || normalized[normalized.length - 1]?.kind === 'separator') {
        continue
      }

      normalized.push(compactRecord({ kind: 'separator', id: nodeId }))
      continue
    }

    if (node.kind === 'submenu') {
      const children = normalizeMenuNodes(
        extensionId,
        contributionId,
        node.children,
        session,
        nodePath
      )
      if (children.length === 0) {
        continue
      }

      normalized.push(
        compactRecord({
          kind: 'submenu',
          id: nodeId,
          label: node.label,
          icon: node.icon,
          disabled: node.disabled,
          children
        })
      )
      continue
    }

    if (node.kind === 'action') {
      const { onClick, ...item } = node
      session.callbacks.set(getNodePathKey(nodePath), {
        nodeId,
        nodePath,
        invoke: (_value) =>
          invokeUiCallback(
            extensionId,
            `Menu callback "${contributionId}:${nodePath.join('/')}"`,
            () => onClick(createMenuEvent(session.input, nodeId, nodePath))
          )
      })

      normalized.push(compactRecord({ ...item, id: nodeId }))
      continue
    }

    if (node.kind === 'checkbox') {
      const { onChange, ...item } = node
      session.callbacks.set(getNodePathKey(nodePath), {
        nodeId,
        nodePath,
        invoke: (value) => {
          if (typeof value !== 'boolean') {
            return Promise.resolve(
              createUiError('Checkbox menu callback requires a boolean value.', {
                code: 'validation_failure'
              })
            )
          }

          return invokeUiCallback(
            extensionId,
            `Menu callback "${contributionId}:${nodePath.join('/')}"`,
            () => onChange(value, createMenuEvent(session.input, nodeId, nodePath))
          )
        }
      })

      normalized.push(compactRecord({ ...item, id: nodeId }))
      continue
    }

    const { onChange, ...item } = node
    session.callbacks.set(getNodePathKey(nodePath), {
      nodeId,
      nodePath,
      invoke: (value) => {
        if (typeof value !== 'string') {
          return Promise.resolve(
            createUiError('Select menu callback requires a string value.', {
              code: 'validation_failure'
            })
          )
        }

        return invokeUiCallback(
          extensionId,
          `Menu callback "${contributionId}:${nodePath.join('/')}"`,
          () => onChange(value, createMenuEvent(session.input, nodeId, nodePath))
        )
      }
    })

    normalized.push(compactRecord({ ...item, id: nodeId }))
  }

  while (normalized[normalized.length - 1]?.kind === 'separator') {
    normalized.pop()
  }

  return normalized
}

function createMenuEvent(
  input: MenuInput,
  nodeId: string,
  nodePath: readonly string[]
): MenuNodeEvent {
  return {
    input,
    nodeId,
    nodePath
  }
}

function collectExplicitMenuNodeIds(nodes: readonly MenuNode[]): Set<string> {
  const ids = new Set<string>()
  for (const node of nodes) {
    if (typeof node.id === 'string' && node.id.length > 0) {
      ids.add(node.id)
    }
  }
  return ids
}

function getMenuNodeId(node: MenuNode, index: number, usedNodeIds: ReadonlySet<string>): string {
  if (typeof node.id === 'string' && node.id.length > 0) {
    return node.id
  }

  const base = `__kisaki_separator:${index}`
  let candidate = base
  let suffix = 1
  while (usedNodeIds.has(candidate)) {
    candidate = `${base}:${suffix}`
    suffix += 1
  }
  return candidate
}

function getNodePathKey(nodePath: readonly string[]): string {
  return nodePath.join('\u0000')
}

function getSessionKey(runtimeHandle: string, contributionId: string, sessionId: string): string {
  return `${runtimeHandle}:${contributionId}:${sessionId}`
}

function compactRecord(record: Record<string, unknown>): Record<string, unknown> {
  const compacted: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) {
      continue
    }
    compacted[key] = value
  }
  return compacted
}
