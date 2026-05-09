import { randomUUID } from 'node:crypto'
import log from 'electron-log/main'
import {
  createUiError,
  readErrorCode,
  type ExtensionRuntimeHandle,
  type MenuContributionRegistration
} from '@kisaki/extension-api'
import type {
  ExtensionContributionError,
  ExtensionMenuContributionInfo,
  ExtensionMenuInvokeRequest,
  ExtensionMenuInvokeResponse,
  ExtensionMenuRefreshRequestedEvent,
  ExtensionMenuReleaseRequest,
  ExtensionMenuResolveRequest,
  ExtensionResolvedMenu,
  ExtensionResolvedMenuGroup,
  ExtensionResolvedMenuNode
} from '@shared/extension'
import {
  getRuntimeContributionKey,
  requireContributionOwner,
  toContributionOwnerInfo,
  type ExtensionContributionHostOptions,
  type RuntimeContributionOwner
} from './types'

interface MenuRegistration {
  owner: RuntimeContributionOwner
  contribution: MenuContributionRegistration
}

interface MainMenuSession {
  sessionId: string
  input: ExtensionMenuResolveRequest['input']
  contributionKeys: Set<string>
  runtimeHandles: Set<ExtensionRuntimeHandle>
}

export class ExtensionMenuContributionHost {
  private readonly registrations = new Map<string, MenuRegistration>()
  private readonly byPublicId = new Map<string, MenuRegistration>()
  private readonly sessions = new Map<string, MainMenuSession>()

  constructor(private readonly options: ExtensionContributionHostOptions) {}

  register(
    runtimeHandle: ExtensionRuntimeHandle,
    contribution: MenuContributionRegistration
  ): void {
    const owner = requireContributionOwner(this.options, runtimeHandle)
    const key = getRuntimeContributionKey(runtimeHandle, contribution.id)
    const publicKey = getPublicContributionKey(owner.extension.id, contribution.id)

    if (this.byPublicId.has(publicKey)) {
      throw new Error(
        `Extension "${owner.extension.id}" already registered menu contribution "${contribution.id}".`
      )
    }

    const registration: MenuRegistration = {
      owner,
      contribution
    }

    this.registrations.set(key, registration)
    this.byPublicId.set(publicKey, registration)
  }

  unregister(runtimeHandle: ExtensionRuntimeHandle, contributionId: string): void {
    const key = getRuntimeContributionKey(runtimeHandle, contributionId)
    const registration = this.registrations.get(key)
    if (!registration) {
      return
    }

    this.registrations.delete(key)
    this.byPublicId.delete(
      getPublicContributionKey(registration.owner.extension.id, contributionId)
    )
    this.clearContributionSessions(registration.owner.extension.id, contributionId)
  }

  releaseRuntime(runtimeHandle: ExtensionRuntimeHandle): void {
    for (const [key, registration] of [...this.registrations]) {
      if (registration.owner.runtimeHandle === runtimeHandle) {
        this.registrations.delete(key)
        this.byPublicId.delete(
          getPublicContributionKey(registration.owner.extension.id, registration.contribution.id)
        )
      }
    }
    this.clearRuntimeSessions(runtimeHandle)
  }

  releaseAll(): void {
    this.registrations.clear()
    this.byPublicId.clear()
    this.sessions.clear()
  }

  getSnapshot(): readonly ExtensionMenuContributionInfo[] {
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

  notifyRefreshRequested(
    runtimeHandle: ExtensionRuntimeHandle,
    contributionId: string,
    reason?: ExtensionMenuRefreshRequestedEvent['reason']
  ): void {
    const registration = this.registrations.get(
      getRuntimeContributionKey(runtimeHandle, contributionId)
    )
    if (!registration) {
      return
    }

    this.options.onMenusRefreshRequested?.({
      extensionId: registration.owner.extension.id,
      contributionId: registration.contribution.id,
      domain: registration.contribution.domain,
      scope: registration.contribution.scope,
      reason
    } as ExtensionMenuRefreshRequestedEvent)
  }

  resolve(request: ExtensionMenuResolveRequest): Promise<ExtensionResolvedMenu> {
    return this.resolveSession(randomUUID(), request)
  }

  async invoke(request: ExtensionMenuInvokeRequest): Promise<ExtensionMenuInvokeResponse> {
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
      getPublicContributionKey(request.extensionId, request.contributionId)
    )
    if (
      !registration ||
      !session.contributionKeys.has(
        getPublicContributionKey(request.extensionId, request.contributionId)
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
        'contributions.menus.invoke',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          contributionId: registration.contribution.id,
          sessionId: request.sessionId,
          nodePath: request.nodePath,
          input: request.input,
          value: request.value
        },
        { timeoutMs: 15_000 }
      )

      return { result }
    } catch (error) {
      log.warn(
        `[ExtensionContributionRegistry] Menu callback "${request.extensionId}:${request.contributionId}" failed:`,
        error
      )
      return {
        result: createUiError(toErrorMessage(error, 'Menu callback failed.'), {
          code: readErrorCode(error) ?? 'internal',
          refresh: false
        })
      }
    }
  }

  async release(request: ExtensionMenuReleaseRequest): Promise<void> {
    if (!request.sessionId) {
      return
    }

    try {
      await this.options.requestHost(
        'contributions.menus.release',
        {
          sessionId: request.sessionId
        },
        { timeoutMs: 5_000 }
      )
    } catch (error) {
      log.warn(
        `[ExtensionContributionRegistry] Failed to release menu session "${request.sessionId}":`,
        error
      )
    } finally {
      this.sessions.delete(request.sessionId)
    }
  }

  private async resolveSession(
    sessionId: string,
    request: ExtensionMenuResolveRequest
  ): Promise<ExtensionResolvedMenu> {
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
          'contributions.menus.resolve',
          {
            runtimeHandle: registration.owner.runtimeHandle,
            contributionId: registration.contribution.id,
            sessionId,
            input: request.input
          },
          { timeoutMs: 15_000 }
        )
      }))
    )

    const groups: ExtensionResolvedMenuGroup[] = []
    const contributionKeys = new Set<string>()
    const runtimeHandles = new Set<ExtensionRuntimeHandle>()
    for (const [index, result] of resolvedEntries.entries()) {
      if (result.status === 'fulfilled') {
        groups.push({
          ...toMenuInfo(result.value.registration),
          nodes: result.value.resolved.nodes as unknown as readonly ExtensionResolvedMenuNode[]
        })
        contributionKeys.add(
          getPublicContributionKey(
            result.value.registration.owner.extension.id,
            result.value.registration.contribution.id
          )
        )
        runtimeHandles.add(result.value.registration.owner.runtimeHandle)
        continue
      }

      const registration = registrations[index]
      if (registration) {
        log.warn(
          `[ExtensionContributionRegistry] Failed to resolve menu "${registration.owner.extension.id}:${registration.contribution.id}":`,
          result.reason
        )
        errors.push(toContributionError(registration, result.reason))
      }
    }

    this.sessions.set(sessionId, {
      sessionId,
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

  private clearContributionSessions(extensionId: string, contributionId: string): void {
    const contributionKey = getPublicContributionKey(extensionId, contributionId)
    for (const [sessionId, session] of [...this.sessions]) {
      if (session.contributionKeys.has(contributionKey)) {
        this.sessions.delete(sessionId)
      }
    }
  }

  private clearRuntimeSessions(runtimeHandle: ExtensionRuntimeHandle): void {
    for (const [sessionId, session] of [...this.sessions]) {
      if (session.runtimeHandles.has(runtimeHandle)) {
        this.sessions.delete(sessionId)
      }
    }
  }
}

function toMenuInfo(registration: MenuRegistration): ExtensionMenuContributionInfo {
  return {
    ...toContributionOwnerInfo(registration.owner),
    contributionId: registration.contribution.id,
    domain: registration.contribution.domain,
    scope: registration.contribution.scope,
    order: registration.contribution.order ?? 0
  } as ExtensionMenuContributionInfo
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

function getPublicContributionKey(extensionId: string, contributionId: string): string {
  return `${extensionId}:${contributionId}`
}

function menuInputsEqual(
  left: ExtensionMenuResolveRequest['input'],
  right: ExtensionMenuResolveRequest['input']
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
