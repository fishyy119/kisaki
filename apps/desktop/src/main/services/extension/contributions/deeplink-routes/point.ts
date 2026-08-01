import type {
  DeeplinkRouteHandleEvent,
  DeeplinkRouteHandleResult,
  DeeplinkRouteRegistrationInfo,
  ExtensionRuntimeHandle
} from '@kisaki3/extension-api'
import { createLogger } from '@main/log'
import type { ExtensionDeeplinkRouteRegistrationInfo } from '@shared/extension'
import {
  compileDeeplinkRoutePattern,
  matchNormalizedDeeplinkRoutePath,
  normalizeDeeplinkRoutePattern,
  type CompiledDeeplinkRoutePattern,
  type DeeplinkResult,
  type DeeplinkRouteContext,
  type DeeplinkRouteHandler,
  type DeeplinkService
} from '@main/services/deeplink'
import {
  getRuntimeContributionKey,
  requireContributionOwner,
  toContributionOwnerInfo,
  type ExtensionContributionReleaseDiagnostic,
  type ExtensionContributionPointOptions,
  type RuntimeContributionOwner
} from '../types'

export interface ExtensionDeeplinkRouteContributionPointOptions extends ExtensionContributionPointOptions {
  deeplink: DeeplinkService
}

const log = createLogger('Extension')

interface DeeplinkRouteRegistration {
  owner: RuntimeContributionOwner
  contribution: DeeplinkRouteRegistrationInfo
  compiled: CompiledDeeplinkRoutePattern
  order: number
}

const EXTENSION_DEEPLINK_ROUTE = '/ext/:extensionId/*routePath' as const

type ExtensionDeeplinkContext = DeeplinkRouteContext<typeof EXTENSION_DEEPLINK_ROUTE>

export class ExtensionDeeplinkRouteContributionPoint {
  private readonly registrations = new Map<string, DeeplinkRouteRegistration>()
  private readonly byExtension = new Map<string, DeeplinkRouteRegistration[]>()
  private nextOrder = 0

  constructor(private readonly options: ExtensionDeeplinkRouteContributionPointOptions) {
    options.deeplink.router.register(EXTENSION_DEEPLINK_ROUTE, new ExtensionDeeplinkHandler(this))
  }

  register(
    runtimeHandle: ExtensionRuntimeHandle,
    contribution: DeeplinkRouteRegistrationInfo
  ): void {
    const owner = requireContributionOwner(this.options, runtimeHandle)
    const path = normalizeExtensionRoutePath(contribution.path)
    const key = getRuntimeContributionKey(runtimeHandle, contribution.id)

    if (this.registrations.has(key)) {
      throw new Error(
        `Extension "${owner.extension.id}" already registered deeplink route "${contribution.id}".`
      )
    }

    const existing = this.byExtension
      .get(owner.extension.id)
      ?.find((registration) => registration.contribution.path === path)
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
        urlPattern: contribution.urlPattern
      },
      compiled: compileDeeplinkRoutePattern(path),
      order: this.nextOrder++
    }

    this.registrations.set(key, registration)
    this.addExtensionRegistration(owner.extension.id, registration)
  }

  unregister(runtimeHandle: ExtensionRuntimeHandle, contributionId: string): void {
    const key = getRuntimeContributionKey(runtimeHandle, contributionId)
    const registration = this.registrations.get(key)
    if (!registration) {
      return
    }

    this.registrations.delete(key)
    this.removeExtensionRegistration(registration)
  }

  releaseRuntime(runtimeHandle: ExtensionRuntimeHandle): void {
    for (const [key, registration] of [...this.registrations]) {
      if (registration.owner.runtimeHandle === runtimeHandle) {
        this.registrations.delete(key)
        this.removeExtensionRegistration(registration)
      }
    }
  }

  releaseAll(): void {
    this.registrations.clear()
    this.byExtension.clear()
  }

  getSnapshot(): readonly ExtensionDeeplinkRouteRegistrationInfo[] {
    return [...this.registrations.values()]
      .map((registration) => ({
        ...toContributionOwnerInfo(registration.owner),
        contribution: registration.contribution
      }))
      .sort((left, right) => left.contribution.path.localeCompare(right.contribution.path))
  }

  getReleaseDiagnostics(extensionId: string): readonly ExtensionContributionReleaseDiagnostic[] {
    const diagnostics: ExtensionContributionReleaseDiagnostic[] = []
    const primaryRegistrations = new Set<DeeplinkRouteRegistration>()

    for (const registration of this.registrations.values()) {
      if (registration.owner.extension.id !== extensionId) {
        continue
      }

      primaryRegistrations.add(registration)
      diagnostics.push({
        domain: 'deeplink routes',
        detail: `${registration.contribution.path}:${registration.contribution.id}`
      })
    }

    for (const registration of this.byExtension.get(extensionId) ?? []) {
      if (!primaryRegistrations.has(registration)) {
        diagnostics.push({
          domain: 'deeplink route index',
          detail: `${registration.contribution.path}:${registration.contribution.id}`
        })
      }
    }

    return diagnostics
  }

  async handle(
    deeplink: ExtensionDeeplinkContext,
    event: DeeplinkRouteHandleEvent
  ): Promise<DeeplinkRouteHandleResult | null> {
    const extensionId = deeplink.params.extensionId
    const routePath = `/${deeplink.params.routePath ?? ''}`
    const matched = this.findRegistration(extensionId, routePath)
    if (!matched) {
      return null
    }

    return this.options.requestHost('contributions.deeplinkRoutes.handle', {
      runtimeHandle: matched.registration.owner.runtimeHandle,
      contributionId: matched.registration.contribution.id,
      event: {
        ...event,
        path: routePath,
        pattern: matched.registration.contribution.path,
        params: matched.params
      }
    })
  }

  private addExtensionRegistration(
    extensionId: string,
    registration: DeeplinkRouteRegistration
  ): void {
    const scoped = this.byExtension.get(extensionId) ?? []
    scoped.push(registration)
    scoped.sort(
      (left, right) => right.compiled.score - left.compiled.score || left.order - right.order
    )
    this.byExtension.set(extensionId, scoped)
  }

  private removeExtensionRegistration(registration: DeeplinkRouteRegistration): void {
    const extensionId = registration.owner.extension.id
    const scoped = this.byExtension.get(extensionId)
    if (!scoped) {
      return
    }

    const next = scoped.filter((entry) => entry !== registration)
    if (next.length === 0) {
      this.byExtension.delete(extensionId)
      return
    }

    this.byExtension.set(extensionId, next)
  }

  private findRegistration(
    extensionId: string,
    routePath: string
  ): { registration: DeeplinkRouteRegistration; params: Record<string, string> } | null {
    const scoped = this.byExtension.get(extensionId)
    if (!scoped) {
      return null
    }

    for (const registration of scoped) {
      const params = matchNormalizedDeeplinkRoutePath(registration.compiled, routePath)
      if (params) {
        return { registration, params }
      }
    }

    return null
  }
}

class ExtensionDeeplinkHandler implements DeeplinkRouteHandler<typeof EXTENSION_DEEPLINK_ROUTE> {
  constructor(private readonly host: ExtensionDeeplinkRouteContributionPoint) {}

  async handle(deeplink: ExtensionDeeplinkContext): Promise<DeeplinkResult> {
    try {
      const response = await this.host.handle(deeplink, {
        path: deeplink.path,
        pattern: deeplink.pattern,
        params: deeplink.params,
        query: deeplink.query,
        rawUrl: deeplink.rawUrl
      })

      if (!response) {
        return {
          success: false,
          path: deeplink.path,
          pattern: deeplink.pattern,
          message: `Unknown extension deeplink route: ${deeplink.path}`
        }
      }

      return {
        success: response.success,
        path: deeplink.path,
        pattern: deeplink.pattern,
        message: response.message,
        data: response.data
      }
    } catch (error) {
      log.warn('Deeplink route failed.', error, { deeplinkPath: deeplink.path })
      return {
        success: false,
        path: deeplink.path,
        pattern: deeplink.pattern,
        message: error instanceof Error ? error.message : 'Extension deeplink route failed.'
      }
    }
  }
}

function normalizeExtensionRoutePath(path: string): string {
  const normalized = normalizeDeeplinkRoutePattern(path)

  if (normalized === '/ext' || normalized.startsWith('/ext/')) {
    throw new Error('Extension deeplink route path must not include the host "/ext" namespace.')
  }

  return normalized
}
