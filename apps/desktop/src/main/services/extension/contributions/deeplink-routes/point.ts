/**
 * Main-side contribution point of `kisaki://ext/<extensionId>/<path>`.
 *
 * Every extension route registers its full pattern directly on the single
 * deeplink router; this point keeps only the registration bookkeeping
 * (snapshot, diagnostics, disposal). A low-specificity fallback route covers
 * the cold-start race: a deeplink that arrives before the target extension
 * finished activating waits for its runtime to reach `running` and is then
 * re-matched against the concrete registrations.
 */

import type {
  DeeplinkRouteHandleEvent,
  DeeplinkRouteRegistrationInfo,
  ExtensionRuntimeHandle
} from '@kisaki3/extension-api'
import { createLogger } from '@main/log'
import type { ExtensionDeeplinkRouteRegistrationInfo } from '@shared/extension'
import {
  compileDeeplinkRoutePattern,
  matchDeeplinkRoutePattern,
  normalizeDeeplinkRoutePattern,
  type CompiledDeeplinkRoutePattern
} from '@shared/deeplink'
import type {
  DeeplinkOutcome,
  DeeplinkRouteContext,
  DeeplinkService
} from '@main/services/deeplink'
import type { NotificationService } from '@main/services/notification'
import type { I18nService } from '@main/services/i18n'
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
  notification: NotificationService
  i18n: I18nService
  waitForExtensionRunning(extensionId: string, timeoutMs: number): Promise<boolean>
}

const log = createLogger('Extension')

const EXTENSION_DEEPLINK_FALLBACK_ROUTE = '/ext/:extensionId/*rest' as const

const EXTENSION_RUNNING_TIMEOUT_MS = 10_000
/** The activating extension's registration RPC may still be in flight. */
const REGISTRATION_SETTLE_ATTEMPTS = 5
const REGISTRATION_SETTLE_DELAY_MS = 200

interface DeeplinkRouteRegistration {
  owner: RuntimeContributionOwner
  contribution: DeeplinkRouteRegistrationInfo
  /** Full pattern under `/ext/<extensionId>`, kept for fallback re-matching. */
  compiled: CompiledDeeplinkRoutePattern
  unregister: () => void
}

export class ExtensionDeeplinkRouteContributionPoint {
  private readonly registrations = new Map<string, DeeplinkRouteRegistration>()

  constructor(private readonly options: ExtensionDeeplinkRouteContributionPointOptions) {
    options.deeplink.router.register(
      EXTENSION_DEEPLINK_FALLBACK_ROUTE,
      (context) => this.handleFallback(context),
      { focus: true }
    )
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

    const fullPattern = `/ext/${owner.extension.id}${path}`
    const registration: DeeplinkRouteRegistration = {
      owner,
      contribution: {
        id: contribution.id,
        path,
        urlPattern: contribution.urlPattern,
        focus: contribution.focus
      },
      compiled: compileDeeplinkRoutePattern(fullPattern),
      unregister: () => {}
    }

    registration.unregister = this.options.deeplink.router.register(
      fullPattern,
      (context) => this.dispatch(registration, context),
      { focus: contribution.focus }
    )
    this.registrations.set(key, registration)
  }

  unregister(runtimeHandle: ExtensionRuntimeHandle, contributionId: string): void {
    const key = getRuntimeContributionKey(runtimeHandle, contributionId)
    const registration = this.registrations.get(key)
    if (!registration) {
      return
    }

    this.registrations.delete(key)
    registration.unregister()
  }

  releaseRuntime(runtimeHandle: ExtensionRuntimeHandle): void {
    for (const [key, registration] of [...this.registrations]) {
      if (registration.owner.runtimeHandle === runtimeHandle) {
        this.registrations.delete(key)
        registration.unregister()
      }
    }
  }

  releaseAll(): void {
    for (const registration of this.registrations.values()) {
      registration.unregister()
    }
    this.registrations.clear()
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

    for (const registration of this.registrations.values()) {
      if (registration.owner.extension.id !== extensionId) {
        continue
      }

      diagnostics.push({
        domain: 'deeplink routes',
        detail: `${registration.contribution.path}:${registration.contribution.id}`
      })
    }

    return diagnostics
  }

  /** Forwards a matched route into the extension host. */
  private async dispatch(
    registration: DeeplinkRouteRegistration,
    context: DeeplinkRouteContext
  ): Promise<DeeplinkOutcome> {
    const prefix = `/ext/${registration.owner.extension.id}`
    const event: DeeplinkRouteHandleEvent = {
      path: context.path.length > prefix.length ? context.path.slice(prefix.length) : '/',
      pattern: registration.contribution.path,
      params: context.params,
      query: context.query
    }

    try {
      const result = await this.options.requestHost('contributions.deeplinkRoutes.handle', {
        runtimeHandle: registration.owner.runtimeHandle,
        contributionId: registration.contribution.id,
        event
      })

      return result.status === 'handled'
        ? { status: 'handled' }
        : {
            status: 'failed',
            message: result.message ?? 'Extension deeplink route reported a failure.'
          }
    } catch (error) {
      // The route exists but the extension could not run it. That failure has
      // no other owner, so this entry adapter notifies the user.
      log.warn('Extension deeplink route failed to run.', error, {
        extensionId: registration.owner.extension.id,
        contributionId: registration.contribution.id
      })
      this.notifyExtensionUnavailable()
      return {
        status: 'failed',
        message: error instanceof Error ? error.message : 'Extension deeplink route failed.'
      }
    }
  }

  /**
   * No concrete route matched: the target extension has not (yet) registered
   * one. Wait for its runtime, give in-flight registrations a moment to land,
   * then re-match.
   */
  private async handleFallback(
    context: DeeplinkRouteContext<typeof EXTENSION_DEEPLINK_FALLBACK_ROUTE>
  ): Promise<DeeplinkOutcome> {
    const extensionId = context.params.extensionId
    const running = await this.options.waitForExtensionRunning(
      extensionId,
      EXTENSION_RUNNING_TIMEOUT_MS
    )

    if (running) {
      for (let attempt = 0; attempt < REGISTRATION_SETTLE_ATTEMPTS; attempt++) {
        const found = this.findRegistration(extensionId, context.path)
        if (found) {
          return this.dispatch(found.registration, {
            path: context.path,
            query: context.query,
            pattern: found.registration.compiled.pattern,
            params: found.params
          })
        }
        await delay(REGISTRATION_SETTLE_DELAY_MS)
      }
    }

    log.warn('Extension deeplink route unavailable.', {
      extensionId,
      requestPath: context.path,
      extensionRunning: running
    })
    this.notifyExtensionUnavailable()
    return {
      status: 'failed',
      message: `No running extension handles deeplink path: ${context.path}`
    }
  }

  private findRegistration(
    extensionId: string,
    path: string
  ): { registration: DeeplinkRouteRegistration; params: Record<string, string> } | null {
    const scoped = [...this.registrations.values()]
      .filter((registration) => registration.owner.extension.id === extensionId)
      .sort((left, right) => right.compiled.score - left.compiled.score)

    for (const registration of scoped) {
      const params = matchDeeplinkRoutePattern(registration.compiled, path)
      if (params) {
        return { registration, params }
      }
    }

    return null
  }

  private notifyExtensionUnavailable(): void {
    const messages = this.options.i18n.messages.deeplink
    this.options.notification.show({
      title: messages.extensionUnavailableTitle,
      message: messages.extensionUnavailableMessage,
      type: 'error',
      target: 'auto'
    })
  }
}

function normalizeExtensionRoutePath(path: string): string {
  const normalized = normalizeDeeplinkRoutePattern(path)

  if (normalized === '/ext' || normalized.startsWith('/ext/')) {
    throw new Error('Extension deeplink route path must not include the host "/ext" namespace.')
  }

  return normalized
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
