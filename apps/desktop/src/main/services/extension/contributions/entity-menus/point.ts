import { randomUUID } from 'node:crypto'
import { createLogger } from '@main/log'
import {
  createUiError,
  readErrorCode,
  type EntityMenuRegistrationInfo,
  type ExtensionRuntimeHandle
} from '@kisaki3/extension-api'
import type {
  ExtensionContributionError,
  ExtensionEntityMenuRegistrationInfo,
  ExtensionEntityMenuInvokeRequest,
  ExtensionEntityMenuInvokeResponse,
  ExtensionEntityMenuRefreshRequestedEvent,
  ExtensionEntityMenuReleaseRequest,
  ExtensionEntityMenuResolveRequest,
  ExtensionResolvedEntityMenu,
  ExtensionResolvedEntityMenuGroup,
  ExtensionResolvedEntityMenuNode
} from '@shared/extension'
import {
  requireContributionOwner,
  toContributionOwnerInfo,
  type ExtensionContributionReleaseDiagnostic,
  type ExtensionContributionDomainOptions,
  type RuntimeContributionOwner
} from '../types'
import { EXTENSION_CLEANUP_TIMEOUT_MS } from '../../shared/rpc-timeouts'

const log = createLogger('Extension')

interface MenuRegistration {
  owner: RuntimeContributionOwner
  contribution: EntityMenuRegistrationInfo
}

interface MainMenuSession {
  sessionId: string
  abortController: AbortController
  input: ExtensionEntityMenuResolveRequest['input']
  contributionKeys: Set<string>
  runtimeHandles: Set<ExtensionRuntimeHandle>
}

export class ExtensionEntityMenuContributionPoint {
  private readonly registrations = new Map<string, MenuRegistration>()
  private readonly byPublicId = new Map<string, MenuRegistration>()
  private readonly sessions = new Map<string, MainMenuSession>()

  constructor(private readonly options: ExtensionContributionDomainOptions) {}

  register(runtimeHandle: ExtensionRuntimeHandle, contribution: EntityMenuRegistrationInfo): void {
    const owner = requireContributionOwner(this.options, runtimeHandle)
    const key = getEntityMenuRuntimeKey(
      runtimeHandle,
      contribution.domain,
      contribution.scope,
      contribution.id
    )
    const publicKey = getPublicContributionKey(
      owner.extension.id,
      contribution.domain,
      contribution.scope,
      contribution.id
    )

    if (this.byPublicId.has(publicKey)) {
      throw new Error(
        `Extension "${owner.extension.id}" already registered entity menu contribution "${contribution.domain}.${contribution.scope}:${contribution.id}".`
      )
    }

    const registration: MenuRegistration = {
      owner,
      contribution
    }

    this.registrations.set(key, registration)
    this.byPublicId.set(publicKey, registration)
  }

  unregister(
    runtimeHandle: ExtensionRuntimeHandle,
    domain: EntityMenuRegistrationInfo['domain'],
    scope: EntityMenuRegistrationInfo['scope'],
    contributionId: string
  ): void {
    const key = getEntityMenuRuntimeKey(runtimeHandle, domain, scope, contributionId)
    const registration = this.registrations.get(key)
    if (!registration) {
      return
    }

    this.registrations.delete(key)
    this.byPublicId.delete(
      getPublicContributionKey(registration.owner.extension.id, domain, scope, contributionId)
    )
    this.clearContributionSessions(registration.owner.extension.id, domain, scope, contributionId)
  }

  releaseRuntime(runtimeHandle: ExtensionRuntimeHandle): void {
    for (const [key, registration] of [...this.registrations]) {
      if (registration.owner.runtimeHandle === runtimeHandle) {
        this.registrations.delete(key)
        this.byPublicId.delete(
          getPublicContributionKey(
            registration.owner.extension.id,
            registration.contribution.domain,
            registration.contribution.scope,
            registration.contribution.id
          )
        )
      }
    }
    this.clearRuntimeSessions(runtimeHandle)
  }

  releaseAll(): void {
    this.registrations.clear()
    this.byPublicId.clear()
    for (const session of this.sessions.values()) {
      session.abortController.abort()
    }
    this.sessions.clear()
  }

  getSnapshot(): readonly ExtensionEntityMenuRegistrationInfo[] {
    return [...this.registrations.values()]
      .map(toMenuInfo)
      .sort(
        (left, right) =>
          left.domain.localeCompare(right.domain) ||
          left.scope.localeCompare(right.scope) ||
          left.order - right.order ||
          left.contributionId.localeCompare(right.contributionId)
      )
  }

  getReleaseDiagnostics(extensionId: string): readonly ExtensionContributionReleaseDiagnostic[] {
    const diagnostics: ExtensionContributionReleaseDiagnostic[] = []
    const primaryKeys = new Set<string>()

    for (const registration of this.registrations.values()) {
      if (registration.owner.extension.id !== extensionId) {
        continue
      }

      const publicKey = getPublicContributionKey(
        extensionId,
        registration.contribution.domain,
        registration.contribution.scope,
        registration.contribution.id
      )
      primaryKeys.add(publicKey)
      diagnostics.push({
        domain: 'entity menus',
        detail: formatMenuContribution(registration)
      })
    }

    for (const [publicKey, registration] of this.byPublicId) {
      if (registration.owner.extension.id === extensionId && !primaryKeys.has(publicKey)) {
        diagnostics.push({
          domain: 'entity menu index',
          detail: publicKey.slice(extensionId.length + 1)
        })
      }
    }

    for (const session of this.sessions.values()) {
      if ([...session.contributionKeys].some((key) => key.startsWith(`${extensionId}:`))) {
        diagnostics.push({
          domain: 'entity menu sessions',
          detail: session.sessionId
        })
      }
    }

    return diagnostics
  }

  notifyRefreshRequested(
    runtimeHandle: ExtensionRuntimeHandle,
    domain: EntityMenuRegistrationInfo['domain'],
    scope: EntityMenuRegistrationInfo['scope'],
    contributionId: string,
    reason?: ExtensionEntityMenuRefreshRequestedEvent['reason']
  ): void {
    const registration = this.registrations.get(
      getEntityMenuRuntimeKey(runtimeHandle, domain, scope, contributionId)
    )
    if (!registration) {
      return
    }

    this.options.onEntityMenusRefreshRequested?.({
      extensionId: registration.owner.extension.id,
      contributionId: registration.contribution.id,
      domain: registration.contribution.domain,
      scope: registration.contribution.scope,
      reason
    } as ExtensionEntityMenuRefreshRequestedEvent)
  }

  resolve(request: ExtensionEntityMenuResolveRequest): Promise<ExtensionResolvedEntityMenu> {
    return this.resolveSession(randomUUID(), request)
  }

  async invoke(
    request: ExtensionEntityMenuInvokeRequest
  ): Promise<ExtensionEntityMenuInvokeResponse> {
    const session = this.sessions.get(request.sessionId)
    if (!session || !menuInputsEqual(session.input, request.input)) {
      return {
        result: createUiError('Menu session is no longer active.', {
          code: 'unavailable',
          refresh: false
        })
      }
    }

    const registration = this.byPublicId.get(
      getPublicContributionKey(
        request.extensionId,
        request.domain,
        request.scope,
        request.contributionId
      )
    )
    if (
      !registration ||
      !session.contributionKeys.has(
        getPublicContributionKey(
          request.extensionId,
          request.domain,
          request.scope,
          request.contributionId
        )
      )
    ) {
      return {
        result: createUiError('Menu contribution is no longer active.', {
          code: 'unavailable',
          refresh: false
        })
      }
    }

    try {
      const result = await this.options.requestHost(
        'contributions.entityMenus.invoke',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          domain: registration.contribution.domain,
          scope: registration.contribution.scope,
          contributionId: registration.contribution.id,
          sessionId: request.sessionId,
          nodePath: request.nodePath,
          input: request.input,
          value: request.value
        },
        { signal: session.abortController.signal }
      )

      return { result }
    } catch (error) {
      log.warn('Menu callback failed.', error, {
        requestExtensionId: request.extensionId,
        requestContributionId: request.contributionId
      })
      return {
        result: createUiError(toErrorMessage(error, 'Menu callback failed.'), {
          code: readErrorCode(error) ?? 'internal',
          refresh: false
        })
      }
    }
  }

  async release(request: ExtensionEntityMenuReleaseRequest): Promise<void> {
    if (!request.sessionId) {
      return
    }

    try {
      await this.options.requestHost(
        'contributions.entityMenus.release',
        {
          sessionId: request.sessionId
        },
        { timeoutMs: EXTENSION_CLEANUP_TIMEOUT_MS }
      )
    } catch (error) {
      log.warn('Failed to release menu session.', error, { requestSessionId: request.sessionId })
    } finally {
      this.sessions.get(request.sessionId)?.abortController.abort()
      this.sessions.delete(request.sessionId)
    }
  }

  private async resolveSession(
    sessionId: string,
    request: ExtensionEntityMenuResolveRequest
  ): Promise<ExtensionResolvedEntityMenu> {
    const abortController = new AbortController()
    const errors: ExtensionContributionError[] = []
    const registrations = [...this.registrations.values()]
      .filter(
        (registration) =>
          registration.contribution.domain === request.input.domain &&
          registration.contribution.scope === request.input.scope
      )
      .sort(
        (left, right) =>
          (left.contribution.order ?? 0) - (right.contribution.order ?? 0) ||
          left.contribution.id.localeCompare(right.contribution.id)
      )

    const resolvedEntries = await Promise.allSettled(
      registrations.map(async (registration) => ({
        registration,
        resolved: await this.options.requestHost(
          'contributions.entityMenus.resolve',
          {
            runtimeHandle: registration.owner.runtimeHandle,
            domain: registration.contribution.domain,
            scope: registration.contribution.scope,
            contributionId: registration.contribution.id,
            sessionId,
            input: request.input
          },
          { signal: abortController.signal }
        )
      }))
    )

    const groups: ExtensionResolvedEntityMenuGroup[] = []
    const contributionKeys = new Set<string>()
    const runtimeHandles = new Set<ExtensionRuntimeHandle>()
    for (const [index, result] of resolvedEntries.entries()) {
      if (result.status === 'fulfilled') {
        groups.push({
          ...toMenuInfo(result.value.registration),
          // Invariant: the host validates and JSON-normalizes resolved nodes
          // before they cross the RPC boundary, so the cast is not re-checked.
          nodes: result.value.resolved
            .nodes as unknown as readonly ExtensionResolvedEntityMenuNode[]
        })
        contributionKeys.add(
          getPublicContributionKey(
            result.value.registration.owner.extension.id,
            result.value.registration.contribution.domain,
            result.value.registration.contribution.scope,
            result.value.registration.contribution.id
          )
        )
        runtimeHandles.add(result.value.registration.owner.runtimeHandle)
        continue
      }

      const registration = registrations[index]
      if (registration) {
        log.warn('Failed to resolve menu.', result.reason, {
          registrationOwnerExtensionId: registration.owner.extension.id,
          registrationContributionId: registration.contribution.id
        })
        errors.push(toContributionError(registration, result.reason))
      }
    }

    this.sessions.set(sessionId, {
      sessionId,
      abortController,
      input: request.input,
      contributionKeys,
      runtimeHandles
    })

    return {
      sessionId,
      input: request.input,
      groups,
      errors
    }
  }

  private clearContributionSessions(
    extensionId: string,
    domain: EntityMenuRegistrationInfo['domain'],
    scope: EntityMenuRegistrationInfo['scope'],
    contributionId: string
  ): void {
    const contributionKey = getPublicContributionKey(extensionId, domain, scope, contributionId)
    for (const [sessionId, session] of [...this.sessions]) {
      if (session.contributionKeys.has(contributionKey)) {
        session.abortController.abort()
        this.sessions.delete(sessionId)
      }
    }
  }

  private clearRuntimeSessions(runtimeHandle: ExtensionRuntimeHandle): void {
    for (const [sessionId, session] of [...this.sessions]) {
      if (session.runtimeHandles.has(runtimeHandle)) {
        session.abortController.abort()
        this.sessions.delete(sessionId)
      }
    }
  }
}

function formatMenuContribution(registration: MenuRegistration): string {
  return `${registration.contribution.domain}.${registration.contribution.scope}:${registration.contribution.id}`
}

function toMenuInfo(registration: MenuRegistration): ExtensionEntityMenuRegistrationInfo {
  return {
    ...toContributionOwnerInfo(registration.owner),
    contributionId: registration.contribution.id,
    domain: registration.contribution.domain,
    scope: registration.contribution.scope,
    order: registration.contribution.order ?? 0
  } as ExtensionEntityMenuRegistrationInfo
}

function toContributionError(
  registration: MenuRegistration,
  error: unknown
): ExtensionContributionError {
  return {
    extensionId: registration.owner.extension.id,
    contributionId: registration.contribution.id,
    message: toErrorMessage(error, 'Menu contribution failed.'),
    code: readErrorCode(error)
  }
}

function getEntityMenuRuntimeKey(
  runtimeHandle: ExtensionRuntimeHandle,
  domain: EntityMenuRegistrationInfo['domain'],
  scope: EntityMenuRegistrationInfo['scope'],
  contributionId: string
): string {
  return `${runtimeHandle}:${domain}:${scope}:${contributionId}`
}

function getPublicContributionKey(
  extensionId: string,
  domain: EntityMenuRegistrationInfo['domain'],
  scope: EntityMenuRegistrationInfo['scope'],
  contributionId: string
): string {
  return `${extensionId}:${domain}:${scope}:${contributionId}`
}

function menuInputsEqual(
  left: ExtensionEntityMenuResolveRequest['input'],
  right: ExtensionEntityMenuResolveRequest['input']
): boolean {
  if (left.domain !== right.domain || left.scope !== right.scope) {
    return false
  }

  if ('entityIds' in left || 'entityIds' in right) {
    return (
      'entityIds' in left && 'entityIds' in right && arraysEqual(left.entityIds, right.entityIds)
    )
  }

  if ('entityId' in left || 'entityId' in right) {
    return 'entityId' in left && 'entityId' in right && left.entityId === right.entityId
  }

  return true
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
