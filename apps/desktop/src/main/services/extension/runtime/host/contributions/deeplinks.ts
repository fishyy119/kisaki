import {
  type DeeplinkContribution,
  type DeeplinkHandleRequest,
  type DeeplinkResponse,
  validateDeeplinkContributionShape,
  validateDeeplinkRequest,
  validateDeeplinkResponse
} from '@kisaki/extension-api'
import {
  createContributionDisposable,
  requireRuntimeByScope,
  throwValidationIssues,
  type ContributionDisposable,
  type HostContributionDomainOptions,
  type HostContributionScope
} from './types'

export class HostDeeplinkContributions {
  constructor(private readonly options: HostContributionDomainOptions) {}

  register(
    scope: HostContributionScope,
    contribution: DeeplinkContribution
  ): ContributionDisposable {
    const issues = validateDeeplinkContributionShape(contribution)
    if (issues.length > 0) {
      throwValidationIssues('Deeplink contribution', issues)
    }

    const runtime = requireRuntimeByScope(this.options.registry, scope)
    if (runtime.deeplinks.has(contribution.id)) {
      throw new Error(
        `Deeplink contribution "${contribution.id}" is already registered by "${scope.extensionId}".`
      )
    }

    this.options.registry.registerDeeplink(scope.extensionId, contribution)
    this.options.trackMainRequest(
      scope,
      this.options.rpc.requestMain(
        'bridge.deeplinks.register',
        {
          runtimeHandle: scope.runtimeHandle,
          contribution: {
            id: contribution.id,
            route: contribution.route
          }
        },
        this.options.getRequestOptions(scope)
      )
    )

    return createContributionDisposable(async () => {
      this.options.registry.unregisterDeeplink(scope.extensionId, contribution.id)
      await this.options.rpc.requestMain(
        'bridge.deeplinks.unregister',
        {
          runtimeHandle: scope.runtimeHandle,
          contributionId: contribution.id
        },
        this.options.getCleanupRequestOptions(scope)
      )
    })
  }

  async handle(request: DeeplinkHandleRequest): Promise<DeeplinkResponse> {
    const runtime = this.options.registry.getByRuntimeHandle(request.runtimeHandle)
    if (!runtime) {
      throw new Error(`Extension runtime "${request.runtimeHandle}" is not active.`)
    }

    const contribution = runtime.deeplinks.get(request.contributionId)
    if (!contribution) {
      throw new Error(
        `Deeplink contribution "${request.contributionId}" is not registered for "${runtime.metadata.id}".`
      )
    }

    const requestIssues = validateDeeplinkRequest(request.input)
    if (requestIssues.length > 0) {
      throwValidationIssues('Deeplink request', requestIssues)
    }

    const response = await this.options.runInExtensionContext(runtime, () =>
      contribution.handle(request.input)
    )
    const responseIssues = validateDeeplinkResponse(response)
    if (responseIssues.length > 0) {
      throwValidationIssues('Deeplink response', responseIssues)
    }

    return response
  }

  releaseRuntime(runtimeHandle: string): void {
    this.options.registry.getByRuntimeHandle(runtimeHandle)?.deeplinks.clear()
  }

  releaseAll(): void {
    for (const runtime of this.options.registry.list()) {
      runtime.deeplinks.clear()
    }
  }
}
