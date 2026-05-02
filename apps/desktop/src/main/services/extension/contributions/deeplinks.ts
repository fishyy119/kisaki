import type {
  DeeplinkContributionRegistration,
  DeeplinkRequest,
  DeeplinkResponse,
  ExtensionRuntimeHandle
} from '@kisaki/extension-api'
import log from 'electron-log/main'
import type { ExtensionDeeplinkContributionInfo } from '@shared/extension'
import type { DeeplinkHandler, DeeplinkResult, ParsedDeeplink } from '@main/services/deeplink'
import {
  getRuntimeContributionKey,
  requireContributionOwner,
  toContributionOwnerInfo,
  type ExtensionContributionHostOptions,
  type RuntimeContributionOwner
} from './types'

interface DeeplinkRegistration {
  owner: RuntimeContributionOwner
  contribution: DeeplinkContributionRegistration
}

export class ExtensionDeeplinkContributionHost {
  private readonly registrations = new Map<string, DeeplinkRegistration>()
  private readonly byRoute = new Map<string, DeeplinkRegistration>()

  constructor(private readonly options: ExtensionContributionHostOptions) {
    options.deeplink?.getRouter().register(new ExtensionDeeplinkHandler(this))
  }

  register(
    runtimeHandle: ExtensionRuntimeHandle,
    contribution: DeeplinkContributionRegistration
  ): void {
    const owner = requireContributionOwner(this.options, runtimeHandle)
    const path = normalizeExtensionLocalPath(contribution.path)
    const route = toInternalRoute(owner.extension.id, path)
    const url = toCanonicalUrl(owner.extension.id, path)

    const existing = this.byRoute.get(route)
    if (existing) {
      throw new Error(
        `Deeplink path "${path}" is already registered by "${existing.owner.extension.id}:${existing.contribution.id}".`
      )
    }

    const registration: DeeplinkRegistration = {
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

  getSnapshot(): readonly ExtensionDeeplinkContributionInfo[] {
    return [...this.registrations.values()]
      .map((registration) => ({
        ...toContributionOwnerInfo(registration.owner),
        contribution: registration.contribution
      }))
      .sort((left, right) => left.contribution.path.localeCompare(right.contribution.path))
  }

  async handle(route: string, input: DeeplinkRequest): Promise<DeeplinkResponse | null> {
    const registration = this.byRoute.get(route)
    if (!registration) {
      return null
    }

    return this.options.requestHost(
      'contributions.deeplinks.handle',
      {
        runtimeHandle: registration.owner.runtimeHandle,
        contributionId: registration.contribution.id,
        input: {
          ...input,
          path: registration.contribution.path
        }
      },
      { timeoutMs: 15_000 }
    )
  }
}

class ExtensionDeeplinkHandler implements DeeplinkHandler {
  readonly action = 'ext' as const

  constructor(private readonly host: ExtensionDeeplinkContributionHost) {}

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
      log.warn(`[ExtensionDeeplinkContributionHost] Route "${route}" failed:`, error)
      return {
        success: false,
        action: this.action,
        message: error instanceof Error ? error.message : 'Extension deeplink route failed.'
      }
    }
  }
}

function normalizeExtensionLocalPath(path: string): string {
  const normalized = path.trim().replace(/^\/+|\/+$/g, '')
  if (!/^[a-z0-9._~-]+(?:\/[a-z0-9._~-]+)*$/i.test(normalized)) {
    throw new Error(
      `Extension deeplink path "${path}" must contain URL-safe path segments without leading slash.`
    )
  }

  if (normalized === 'ext' || normalized.startsWith('ext/')) {
    throw new Error('Extension deeplink path must not include the host "ext" namespace.')
  }

  return normalized
}

function toInternalRoute(extensionId: string, path: string): string {
  return `ext/${extensionId}/${path}`
}

function toCanonicalUrl(extensionId: string, path: string): string {
  return `kisaki://ext/${extensionId}/${path}`
}
