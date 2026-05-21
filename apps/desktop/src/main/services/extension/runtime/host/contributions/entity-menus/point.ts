import {
  createUiError,
  type EntityMenuContribution,
  type EntityMenuDomain,
  type EntityMenuInput,
  type EntityMenuInputFor,
  type EntityMenuInvokeRequest,
  type EntityMenuNode,
  type EntityMenuNodeEvent,
  type EntityMenuNodeFactory,
  type EntityMenuRegistration,
  type EntityMenuRegistrationInfo,
  type EntityMenuReleaseRequest,
  type EntityMenuResolveRequest,
  type EntityMenuResolveResponse,
  type EntityMenuScope,
  type UiCallbackResult,
  validateEntityMenuContributionShape,
  validateEntityMenuNodes
} from '@kisaki/extension-api'
import { requireRuntimeByScope, throwValidationIssues } from '../shared'
import type { HostContributionDomainOptions, HostContributionScope } from '../types'
import { createContributionRegistration } from '../registration'
import { invokeUiCallback } from '../ui'
import { toSerializableRecord } from '../../sdk-bridge/utils/serialization'
import {
  getEntityMenuRegistrationMap,
  type LoadedExtensionRuntime,
  type RegisteredEntityMenuContribution
} from '../../extension-registry'

interface EntityMenuSession {
  runtimeHandle: string
  contributionId: string
  domain: EntityMenuDomain
  scope: EntityMenuRegistrationInfo['scope']
  sessionId: string
  input: EntityMenuInput
  callbacks: Map<string, EntityMenuCallbackRecord>
}

interface EntityMenuCallbackRecord {
  nodeId: string
  nodePath: readonly string[]
  invoke(value: boolean | string | undefined, signal: AbortSignal): Promise<UiCallbackResult>
}

/**
 * Host-side menu contribution domain.
 *
 * It keeps callback functions in the extension host and only exposes resolved,
 * serializable menu nodes to the main process.
 */
export class HostEntityMenuContributionPoint {
  private readonly sessions = new Map<string, EntityMenuSession>()

  constructor(private readonly options: HostContributionDomainOptions) {}

  register<TDomain extends EntityMenuDomain, TScope extends EntityMenuScope<TDomain>>(
    scope: HostContributionScope,
    domain: TDomain,
    menuScope: TScope,
    contribution: EntityMenuContribution<EntityMenuInputFor<TDomain, TScope>>
  ): EntityMenuRegistration {
    const issues = validateEntityMenuContributionShape(contribution)
    if (issues.length > 0) {
      throwValidationIssues('Entity menu contribution', issues)
    }

    const runtime = requireRuntimeByScope(this.options.registry, scope)
    const registrationScope = menuScope as EntityMenuRegistrationInfo['scope']
    if (getEntityMenuRegistrationMap(runtime, domain, menuScope).has(contribution.id)) {
      throw new Error(
        `Entity menu contribution "${contribution.id}" is already registered by "${scope.extensionId}".`
      )
    }

    this.options.registry.registerEntityMenu(scope.extensionId, {
      id: contribution.id,
      domain,
      scope: menuScope,
      order: contribution.order,
      contribution
    })
    const request = this.options.rpc.requestMain(
      'contributions.entityMenus.register',
      {
        runtimeHandle: scope.runtimeHandle,
        menu: createEntityMenuRegistrationInfo(
          contribution.id,
          domain,
          menuScope,
          contribution.order
        )
      },
      this.options.getRequestOptions(scope)
    )

    const registration = createContributionRegistration({
      scope,
      label: `Entity menu contribution "${contribution.id}"`,
      mainRegistration: request,
      reportDiagnostic: (diagnostic) => this.options.reportDiagnostic(scope, diagnostic),
      disposeLocal: () => {
        this.clearContributionSessions(
          scope.runtimeHandle,
          domain,
          registrationScope,
          contribution.id
        )
        this.options.registry.unregisterEntityMenu(
          scope.extensionId,
          domain,
          menuScope,
          contribution.id
        )
      },
      unregisterMain: () =>
        this.options.rpc.requestMain(
          'contributions.entityMenus.unregister',
          {
            runtimeHandle: scope.runtimeHandle,
            domain,
            scope: registrationScope,
            contributionId: contribution.id
          },
          this.options.getCleanupRequestOptions(scope)
        ),
      invalidateLocal: () => {
        this.clearContributionSessions(
          scope.runtimeHandle,
          domain,
          registrationScope,
          contribution.id
        )
        this.options.registry.unregisterEntityMenu(
          scope.extensionId,
          domain,
          menuScope,
          contribution.id
        )
      },
      onSyncFailure: (error) => {
        runtime.context.logger.error(
          `Entity menu contribution "${contribution.id}" was disabled because main registry synchronization failed.`,
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
          'contributions.entityMenus.refreshRequested',
          {
            runtimeHandle: scope.runtimeHandle,
            domain,
            scope: registrationScope,
            contributionId: contribution.id,
            reason
          },
          this.options.getRequestOptions(scope)
        )
      }
    }
  }

  async resolve(
    request: EntityMenuResolveRequest,
    signal: AbortSignal
  ): Promise<EntityMenuResolveResponse> {
    const runtime = this.requireRuntimeForRequest(request.runtimeHandle)
    const registration = getEntityMenuRegistrationForPath(
      runtime,
      request.domain,
      request.scope,
      request.contributionId
    )

    if (!registration) {
      throw new Error(
        `Entity menu contribution "${request.domain}.${request.scope}:${request.contributionId}" is not registered for "${runtime.metadata.id}".`
      )
    }

    if (request.domain !== request.input.domain || request.scope !== request.input.scope) {
      throw new Error(
        `Entity menu contribution "${registration.id}" targets "${request.domain}.${request.scope}" but received "${request.input.domain}.${request.input.scope}".`
      )
    }

    const nodes = await this.options.runInExtensionContext(
      runtime,
      () => resolveRegisteredMenuContribution(registration, request.input),
      signal
    )
    const nodeIssues = validateEntityMenuNodes(nodes)
    if (nodeIssues.length > 0) {
      throwValidationIssues('Resolved menu nodes', nodeIssues)
    }

    const session: EntityMenuSession = {
      runtimeHandle: request.runtimeHandle,
      contributionId: request.contributionId,
      domain: request.domain,
      scope: request.scope,
      sessionId: request.sessionId,
      input: request.input,
      callbacks: new Map()
    }
    const normalizedNodes = normalizeMenuNodes(runtime.metadata.id, registration.id, nodes, session)
    const serializableNodes = normalizedNodes.map((node, index) =>
      toSerializableRecord(node, `resolved menu node ${index}`)
    )

    const sessionKey = getSessionKey(
      request.runtimeHandle,
      request.domain,
      request.scope,
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

  async invoke(request: EntityMenuInvokeRequest, signal: AbortSignal): Promise<UiCallbackResult> {
    const runtime = this.requireRuntimeForRequest(request.runtimeHandle)
    const sessionKey = getSessionKey(
      request.runtimeHandle,
      request.domain,
      request.scope,
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

    return this.options.runInExtensionContext(
      runtime,
      () => callback.invoke(request.value, signal),
      signal
    )
  }

  release(request: EntityMenuReleaseRequest): void {
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

  private clearContributionSessions(
    runtimeHandle: string,
    domain: EntityMenuDomain,
    scope: EntityMenuRegistrationInfo['scope'],
    contributionId: string
  ): void {
    for (const [sessionKey, session] of [...this.sessions]) {
      if (
        session.runtimeHandle === runtimeHandle &&
        session.domain === domain &&
        session.scope === scope &&
        session.contributionId === contributionId
      ) {
        this.deleteSession(sessionKey)
      }
    }
  }

  private storeSession(sessionKey: string, session: EntityMenuSession): void {
    this.deleteSession(sessionKey)
    this.sessions.set(sessionKey, session)
  }

  private deleteSession(sessionKey: string): void {
    this.sessions.delete(sessionKey)
  }
}

function createMenuNodeFactory<TInput extends EntityMenuInput>(): EntityMenuNodeFactory<TInput> {
  return {
    action: (node) => ({ ...node, kind: 'action' }),
    checkbox: (node) => ({ ...node, kind: 'checkbox' }),
    select: (node) => ({ ...node, kind: 'select' }),
    submenu: (node) => ({ ...node, kind: 'submenu' }),
    separator: (node = {}) => ({ ...node, kind: 'separator' })
  }
}

function createEntityMenuRegistrationInfo<
  TDomain extends EntityMenuDomain,
  TScope extends EntityMenuScope<TDomain>
>(
  id: string,
  domain: TDomain,
  scope: TScope,
  order: number | undefined
): EntityMenuRegistrationInfo {
  return { id, domain, scope, order } as EntityMenuRegistrationInfo
}

function getEntityMenuRegistrationForPath(
  runtime: LoadedExtensionRuntime,
  domain: EntityMenuDomain,
  scope: EntityMenuRegistrationInfo['scope'],
  contributionId: string
): RegisteredEntityMenuContribution | undefined {
  switch (domain) {
    case 'game':
      return runtime.entityMenus.game[scope]?.get(contributionId)
    case 'character':
      return scope === 'single'
        ? runtime.entityMenus.character.single.get(contributionId)
        : undefined
    case 'person':
      return scope === 'single' ? runtime.entityMenus.person.single.get(contributionId) : undefined
    case 'company':
      return scope === 'single' ? runtime.entityMenus.company.single.get(contributionId) : undefined
    case 'collection':
      return scope === 'single'
        ? runtime.entityMenus.collection.single.get(contributionId)
        : undefined
    case 'tag':
      return scope === 'single' ? runtime.entityMenus.tag.single.get(contributionId) : undefined
  }
}

function resolveRegisteredMenuContribution(
  registration: RegisteredEntityMenuContribution,
  input: EntityMenuInput
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
  nodes: readonly EntityMenuNode[],
  session: EntityMenuSession,
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
  input: EntityMenuInput,
  nodeId: string,
  nodePath: readonly string[]
): EntityMenuNodeEvent {
  return {
    input,
    nodeId,
    nodePath
  }
}

function collectExplicitMenuNodeIds(nodes: readonly EntityMenuNode[]): Set<string> {
  const ids = new Set<string>()
  for (const node of nodes) {
    if (typeof node.id === 'string' && node.id.length > 0) {
      ids.add(node.id)
    }
  }
  return ids
}

function getMenuNodeId(
  node: EntityMenuNode,
  index: number,
  usedNodeIds: ReadonlySet<string>
): string {
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

function getSessionKey(
  runtimeHandle: string,
  domain: EntityMenuDomain,
  scope: EntityMenuRegistrationInfo['scope'],
  contributionId: string,
  sessionId: string
): string {
  return `${runtimeHandle}:${domain}:${scope}:${contributionId}:${sessionId}`
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
