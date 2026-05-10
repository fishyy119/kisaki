import {
  type DeeplinkRouteContribution,
  type DeeplinkRouteRegistration,
  type DeeplinkRouteHandleRequest,
  type DeeplinkRouteHandleResponse,
  validateDeeplinkRouteContributionShape,
  validateDeeplinkRouteHandleEvent,
  validateDeeplinkRouteHandleResult
} from '@kisaki/extension-api'
import { requireRuntimeByScope, throwValidationIssues } from '../utils'
import type { HostContributionDomainOptions, HostContributionScope } from '../types'
import { createContributionRegistration } from '../registration'

export class HostDeeplinkRouteContributions {
  constructor(private readonly options: HostContributionDomainOptions) {}

  register(
    scope: HostContributionScope,
    contribution: DeeplinkRouteContribution
  ): DeeplinkRouteRegistration {
    const issues = validateDeeplinkRouteContributionShape(contribution)
    if (issues.length > 0) {
      throwValidationIssues('Deeplink route contribution', issues)
    }

    const runtime = requireRuntimeByScope(this.options.registry, scope)
    if (runtime.deeplinkRoutes.has(contribution.id)) {
      throw new Error(
        `Deeplink route contribution "${contribution.id}" is already registered by "${scope.extensionId}".`
      )
    }

    const path = normalizeDeeplinkPath(contribution.path)
    for (const route of runtime.deeplinkRoutes.values()) {
      if (route.path === path) {
        throw new Error(
          `Deeplink route path "${path}" is already registered by "${scope.extensionId}".`
        )
      }
    }

    this.options.registry.registerDeeplinkRoute(scope.extensionId, { ...contribution, path })
    const url = `kisaki://ext/${scope.extensionId}${path}`
    const request = this.options.rpc.requestMain(
      'contributions.deeplinkRoutes.register',
      {
        runtimeHandle: scope.runtimeHandle,
        route: {
          id: contribution.id,
          path,
          url
        }
      },
      this.options.getRequestOptions(scope)
    )

    const registration = createContributionRegistration({
      scope,
      label: `Deeplink route contribution "${contribution.id}"`,
      mainRegistration: request,
      reportDiagnostic: (diagnostic) => this.options.reportDiagnostic(scope, diagnostic),
      disposeLocal: () => {
        this.options.registry.unregisterDeeplinkRoute(scope.extensionId, contribution.id)
      },
      unregisterMain: () =>
        this.options.rpc.requestMain(
          'contributions.deeplinkRoutes.unregister',
          {
            runtimeHandle: scope.runtimeHandle,
            contributionId: contribution.id
          },
          this.options.getCleanupRequestOptions(scope)
        ),
      invalidateLocal: () => {
        this.options.registry.unregisterDeeplinkRoute(scope.extensionId, contribution.id)
      },
      onSyncFailure: (error) => {
        runtime.context.logger.error(
          `Deeplink route contribution "${contribution.id}" was disabled because main registry synchronization failed.`,
          error
        )
      }
    })
    this.options.trackMainRequest(scope, registration.sync)
    return {
      url,
      dispose: () => registration.dispose()
    }
  }

  async handle(request: DeeplinkRouteHandleRequest): Promise<DeeplinkRouteHandleResponse> {
    const runtime = this.options.registry.getByRuntimeHandle(request.runtimeHandle)
    if (!runtime) {
      throw new Error(`Extension runtime "${request.runtimeHandle}" is not active.`)
    }

    const contribution = runtime.deeplinkRoutes.get(request.contributionId)
    if (!contribution) {
      throw new Error(
        `Deeplink route contribution "${request.contributionId}" is not registered for "${runtime.metadata.id}".`
      )
    }

    const requestIssues = validateDeeplinkRouteHandleEvent(request.event)
    if (requestIssues.length > 0) {
      throwValidationIssues('Deeplink route handle event', requestIssues)
    }

    const response = await this.options.runInExtensionContext(runtime, () =>
      contribution.handle(request.event)
    )
    const responseIssues = validateDeeplinkRouteHandleResult(response)
    if (responseIssues.length > 0) {
      throwValidationIssues('Deeplink route handle result', responseIssues)
    }

    return response
  }

  releaseRuntime(runtimeHandle: string): void {
    this.options.registry.getByRuntimeHandle(runtimeHandle)?.deeplinkRoutes.clear()
  }

  releaseAll(): void {
    for (const runtime of this.options.registry.list()) {
      runtime.deeplinkRoutes.clear()
    }
  }
}

function normalizeDeeplinkPath(path: string): string {
  const normalized = path.trim()
  if (!normalized.startsWith('/')) {
    throw new Error(`Extension deeplink route path "${path}" must start with "/".`)
  }

  if (normalized.includes('?') || normalized.includes('#') || /^[a-z][a-z0-9+.-]*:/i.test(path)) {
    throw new Error(
      `Extension deeplink route path "${path}" must not include query, hash, or a full URL.`
    )
  }

  if (
    normalized.includes('\\') ||
    normalized.split('/').some((segment) => segment === '..') ||
    (normalized.length > 1 &&
      normalized.split('/').some((segment, index) => index > 0 && segment === ''))
  ) {
    throw new Error(
      `Extension deeplink route path "${path}" must not include backslashes, empty segments, or "..".`
    )
  }

  if (normalized === '/ext' || normalized.startsWith('/ext/')) {
    throw new Error('Extension deeplink route path must not include the host "/ext" namespace.')
  }

  return normalized
}
