import type {
  DeeplinkRouteHandleEvent,
  DeeplinkRouteHandleResult,
  DeeplinkRouteRegistrationInfo,
  ExtensionRuntimeHandle
} from '@kisaki/extension-api'
import log from 'electron-log/main'
import type { ExtensionDeeplinkRouteRegistrationInfo } from '@shared/extension'
import type { DeeplinkHandler, DeeplinkResult, ParsedDeeplink } from '@main/services/deeplink'
import {
  getRuntimeContributionKey,
  requireContributionOwner,
  toContributionOwnerInfo,
  type ExtensionContributionHostOptions,
  type RuntimeContributionOwner
} from '../types'

interface DeeplinkRouteRegistration {
  owner: RuntimeContributionOwner
  contribution: DeeplinkRouteRegistrationInfo
}

export class ExtensionDeeplinkRouteContributionHost {
  private readonly registrations = new Map<string, DeeplinkRouteRegistration>()
  private readonly byRoute = new Map<string, DeeplinkRouteRegistration>()

  constructor(private readonly options: ExtensionContributionHostOptions) {
    options.deeplink?.getRouter().register(new ExtensionDeeplinkHandler(this))
  }

  register(
    runtimeHandle: ExtensionRuntimeHandle,
    contribution: DeeplinkRouteRegistrationInfo
  ): void {
    const owner = requireContributionOwner(this.options, runtimeHandle)
    const path = normalizeExtensionRoutePath(contribution.path)
    const route = toInternalRoute(owner.extension.id, path)
    const url = contribution.url

    const existing = this.byRoute.get(route)
    if (existing) {
      throw new Error(
        `Deeplink path "${path}" is already registered by "${existing.owner.extension.id}:${existing.contribution.id}".`
      )
    }

    const registration: DeeplinkRouteRegistration = {
      owner,
      contribution: {
        id: contribution.id,
        path,
        url
      }
    }

    this.registrations.set(getRuntimeContributionKey(runtimeHandle, contribution.id), registration)
    this.byRoute.set(route, registration)
  }

  unregister(runtimeHandle: ExtensionRuntimeHandle, contributionId: string): void {
    const key = getRuntimeContributionKey(runtimeHandle, contributionId)
    const registration = this.registrations.get(key)
    if (!registration) {
      return
    }

    this.registrations.delete(key)
    this.byRoute.delete(
      toInternalRoute(registration.owner.extension.id, registration.contribution.path)
    )
  }

  releaseRuntime(runtimeHandle: ExtensionRuntimeHandle): void {
    for (const [key, registration] of [...this.registrations]) {
      if (registration.owner.runtimeHandle === runtimeHandle) {
        this.registrations.delete(key)
        this.byRoute.delete(
          toInternalRoute(registration.owner.extension.id, registration.contribution.path)
        )
      }
    }
  }

  releaseAll(): void {
    this.registrations.clear()
    this.byRoute.clear()
  }

  getSnapshot(): readonly ExtensionDeeplinkRouteRegistrationInfo[] {
    return [...this.registrations.values()]
      .map((registration) => ({
        ...toContributionOwnerInfo(registration.owner),
        contribution: registration.contribution
      }))
      .sort((left, right) => left.contribution.path.localeCompare(right.contribution.path))
  }

  async handle(
    route: string,
    event: DeeplinkRouteHandleEvent
  ): Promise<DeeplinkRouteHandleResult | null> {
    const registration = this.byRoute.get(route)
    if (!registration) {
      return null
    }

    return this.options.requestHost(
      'contributions.deeplinkRoutes.handle',
      {
        runtimeHandle: registration.owner.runtimeHandle,
        contributionId: registration.contribution.id,
        event: {
          ...event,
          path: registration.contribution.path
        }
      },
      { timeoutMs: 15_000 }
    )
  }
}

class ExtensionDeeplinkHandler implements DeeplinkHandler {
  readonly action = 'ext' as const

  constructor(private readonly host: ExtensionDeeplinkRouteContributionHost) {}

  async handle(deeplink: ParsedDeeplink): Promise<DeeplinkResult> {
    const route = `ext/${deeplink.resource}`

    try {
      const response = await this.host.handle(route, {
        path: deeplink.resource,
        params: deeplink.params,
        rawUrl: deeplink.raw
      })

      if (!response) {
        return {
          success: false,
          action: this.action,
          message: `Unknown extension deeplink route: ${route}`
        }
      }

      return {
        success: response.success,
        action: this.action,
        message: response.message,
        data: response.data
      }
    } catch (error) {
      log.warn(`[ExtensionDeeplinkRouteContributionHost] Route "${route}" failed:`, error)
      return {
        success: false,
        action: this.action,
        message: error instanceof Error ? error.message : 'Extension deeplink route failed.'
      }
    }
  }
}

function normalizeExtensionRoutePath(path: string): string {
  const normalized = path.trim()
  if (
    !normalized.startsWith('/') ||
    normalized.includes('?') ||
    normalized.includes('#') ||
    normalized.includes('\\') ||
    normalized.split('/').some((segment) => segment === '..') ||
    (normalized.length > 1 &&
      normalized.split('/').some((segment, index) => index > 0 && segment === ''))
  ) {
    throw new Error(
      `Extension deeplink route path "${path}" must be a canonical leading-slash route path.`
    )
  }

  if (normalized === '/ext' || normalized.startsWith('/ext/')) {
    throw new Error('Extension deeplink route path must not include the host "/ext" namespace.')
  }

  return normalized
}

function toInternalRoute(extensionId: string, path: string): string {
  return `ext/${extensionId}${path}`
}
