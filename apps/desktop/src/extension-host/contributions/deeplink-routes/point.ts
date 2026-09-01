import {
  type DeeplinkRouteContribution,
  type DeeplinkRouteRegistration,
  type DeeplinkRouteHandleRequest,
  type DeeplinkRouteHandleResponse,
  validateDeeplinkRouteContributionShape,
  validateDeeplinkRouteHandleEvent,
  validateDeeplinkRouteHandleResult
} from '@kisaki3/extension-api'
import { buildExtensionDeeplinkUrl, normalizeDeeplinkRoutePattern } from '@shared/deeplink'
import { requireRuntimeByScope, throwValidationIssues } from '../shared'
import type { HostContributionDomainOptions, HostContributionScope } from '../types'
import { createContributionRegistration } from '../registration'

export class HostDeeplinkRouteContributionPoint {
  constructor(private readonly options: HostContributionDomainOptions) {}

  register<const TPattern extends string>(
    scope: HostContributionScope,
    contribution: DeeplinkRouteContribution<TPattern>
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

    const path = normalizeExtensionDeeplinkRoutePath(contribution.path)
    for (const route of runtime.deeplinkRoutes.values()) {
      if (route.path === path) {
        throw new Error(
          `Deeplink route path "${path}" is already registered by "${scope.extensionId}".`
        )
      }
    }

    this.options.registry.registerDeeplinkRoute(scope.extensionId, {
      ...contribution,
      path
    } as unknown as DeeplinkRouteContribution)
    const urlPattern = buildExtensionDeeplinkUrl(scope.extensionId, path)
    const request = this.options.rpc.requestMain(
      'contributions.deeplinkRoutes.register',
      {
        runtimeHandle: scope.runtimeHandle,
        route: {
          id: contribution.id,
          path,
          urlPattern,
          focus: contribution.focus ?? true
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
      urlPattern,
      dispose: () => registration.dispose()
    }
  }

  async handle(
    request: DeeplinkRouteHandleRequest,
    signal: AbortSignal
  ): Promise<DeeplinkRouteHandleResponse> {
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

    const result = await this.options.runInExtensionContext(
      runtime,
      () => contribution.handle(request.event),
      signal
    )
    const responseIssues = validateDeeplinkRouteHandleResult(result)
    if (responseIssues.length > 0) {
      throwValidationIssues('Deeplink route handle result', responseIssues)
    }

    // The RPC channel normalizes the shape-validated result into the JSON
    // model on response.
    return result as DeeplinkRouteHandleResponse
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

function normalizeExtensionDeeplinkRoutePath(path: string): string {
  const normalized = normalizeDeeplinkRoutePattern(path)

  if (normalized === '/ext' || normalized.startsWith('/ext/')) {
    throw new Error('Extension deeplink route path must not include the host "/ext" namespace.')
  }

  return normalized
}
