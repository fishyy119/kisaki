import { randomUUID } from 'node:crypto'
import log from 'electron-log/main'
import {
  createUiError,
  readErrorCode,
  type EntityMenuContributionRegistration,
  type EntityMenuResolveInput,
  type ExtensionRuntimeHandle
} from '@kisaki/extension-api'
import type {
  ExtensionContributionError,
  ExtensionEntityMenuContributionInfo,
  ExtensionEntityMenuInvokeRequest,
  ExtensionEntityMenuInvokeResult,
  ExtensionResolvedEntityMenu,
  ExtensionResolvedEntityMenuGroup
} from '@shared/extension'
import {
  getRuntimeContributionKey,
  requireContributionOwner,
  toContributionOwnerInfo,
  type ExtensionContributionHostOptions,
  type RuntimeContributionOwner
} from './types'

interface EntityMenuRegistration {
  owner: RuntimeContributionOwner
  contribution: EntityMenuContributionRegistration
}

export class ExtensionEntityMenuContributionHost {
  private readonly registrations = new Map<string, EntityMenuRegistration>()
  private readonly byPublicId = new Map<string, EntityMenuRegistration>()

  constructor(private readonly options: ExtensionContributionHostOptions) {}

  register(
    runtimeHandle: ExtensionRuntimeHandle,
    contribution: EntityMenuContributionRegistration
  ): void {
    const owner = requireContributionOwner(this.options, runtimeHandle)
    const registration: EntityMenuRegistration = {
      owner,
      contribution
    }

    this.registrations.set(getRuntimeContributionKey(runtimeHandle, contribution.id), registration)
    this.byPublicId.set(getPublicContributionKey(owner.extension.id, contribution.id), registration)
  }

  unregister(runtimeHandle: ExtensionRuntimeHandle, contributionId: string): void {
    const registration = this.registrations.get(
      getRuntimeContributionKey(runtimeHandle, contributionId)
    )
    if (!registration) {
      return
    }

    this.registrations.delete(getRuntimeContributionKey(runtimeHandle, contributionId))
    this.byPublicId.delete(
      getPublicContributionKey(registration.owner.extension.id, contributionId)
    )
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
  }

  releaseAll(): void {
    this.registrations.clear()
    this.byPublicId.clear()
  }

  getSnapshot(): readonly ExtensionEntityMenuContributionInfo[] {
    return [...this.registrations.values()]
      .map(toEntityMenuInfo)
      .sort(
        (left, right) =>
          left.order - right.order || left.contributionId.localeCompare(right.contributionId)
      )
  }

  resolve(input: EntityMenuResolveInput): Promise<ExtensionResolvedEntityMenu> {
    return this.resolveSession(randomUUID(), input)
  }

  async invoke(
    request: ExtensionEntityMenuInvokeRequest
  ): Promise<ExtensionEntityMenuInvokeResult> {
    const registration = this.byPublicId.get(
      getPublicContributionKey(request.extensionId, request.contributionId)
    )
    if (!registration) {
      return {
        result: createUiError('Entity menu contribution is no longer active.', {
          code: 'unavailable'
        })
      }
    }

    try {
      const result = await this.options.requestHost(
        'entityMenus.invoke',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          contributionId: registration.contribution.id,
          sessionId: request.sessionId,
          callbackId: request.callbackId,
          input: request.input,
          value: request.value
        },
        { timeoutMs: 15_000 }
      )

      return {
        result,
        refreshed: result.refresh
          ? await this.resolveSession(request.sessionId, request.input)
          : undefined
      }
    } catch (error) {
      log.warn(
        `[ExtensionContributionRegistry] Entity menu callback "${request.extensionId}:${request.contributionId}" failed:`,
        error
      )
      return {
        result: createUiError(toErrorMessage(error, 'Entity menu callback failed.'), {
          code: readErrorCode(error) ?? 'internal'
        })
      }
    }
  }

  async releaseSession(sessionId: string): Promise<void> {
    if (!sessionId) {
      return
    }

    await Promise.all(
      [...this.registrations.values()].map((registration) =>
        this.options
          .requestHost(
            'entityMenus.session.release',
            {
              runtimeHandle: registration.owner.runtimeHandle,
              contributionId: registration.contribution.id,
              sessionId
            },
            { timeoutMs: 5_000 }
          )
          .catch((error) => {
            log.warn(
              `[ExtensionContributionRegistry] Failed to release entity menu session "${sessionId}" for "${registration.owner.extension.id}:${registration.contribution.id}":`,
              error
            )
          })
      )
    )
  }

  private async resolveSession(
    sessionId: string,
    input: EntityMenuResolveInput
  ): Promise<ExtensionResolvedEntityMenu> {
    const groups: ExtensionResolvedEntityMenuGroup[] = []
    const errors: ExtensionContributionError[] = []
    const registrations = [...this.registrations.values()]
      .filter((registration) => registration.contribution.target === input.target)
      .sort(
        (left, right) =>
          (left.contribution.order ?? 0) - (right.contribution.order ?? 0) ||
          left.contribution.id.localeCompare(right.contribution.id)
      )

    for (const registration of registrations) {
      try {
        const resolved = await this.options.requestHost(
          'entityMenus.resolve',
          {
            runtimeHandle: registration.owner.runtimeHandle,
            contributionId: registration.contribution.id,
            sessionId,
            input
          },
          { timeoutMs: 15_000 }
        )

        groups.push({
          ...toEntityMenuInfo(registration),
          items: resolved.items
        })
      } catch (error) {
        log.warn(
          `[ExtensionContributionRegistry] Failed to resolve entity menu "${registration.owner.extension.id}:${registration.contribution.id}":`,
          error
        )
        errors.push(toContributionError(registration, error))
      }
    }

    return {
      sessionId,
      target: input.target,
      groups,
      errors
    }
  }
}

function toEntityMenuInfo(
  registration: EntityMenuRegistration
): ExtensionEntityMenuContributionInfo {
  return {
    ...toContributionOwnerInfo(registration.owner),
    contributionId: registration.contribution.id,
    target: registration.contribution.target,
    order: registration.contribution.order ?? 0
  }
}

function toContributionError(
  registration: EntityMenuRegistration,
  error: unknown
): ExtensionContributionError {
  return {
    extensionId: registration.owner.extension.id,
    contributionId: registration.contribution.id,
    message: toErrorMessage(error, 'Entity menu contribution failed.'),
    code: readErrorCode(error)
  }
}

function getPublicContributionKey(extensionId: string, contributionId: string): string {
  return `${extensionId}:${contributionId}`
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
