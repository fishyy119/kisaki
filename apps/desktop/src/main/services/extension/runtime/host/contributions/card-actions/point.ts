import type {
  CardActionContribution,
  CardActionRegistration,
  ContributionScopedRpcParams,
  RpcNoPayload
} from '@kisaki3/extension-api'
import { validateCardActionContributionShape } from '@kisaki3/extension-api'
import { requireRuntimeByScope, throwValidationIssues } from '../shared'
import type { HostContributionDomainOptions, HostContributionScope } from '../types'
import { createContributionRegistration } from '../registration'

export class HostCardActionContributionPoint {
  constructor(private readonly options: HostContributionDomainOptions) {}

  register(scope: HostContributionScope, action: CardActionContribution): CardActionRegistration {
    const issues = validateCardActionContributionShape(action)
    if (issues.length > 0) {
      throwValidationIssues('Card action contribution', issues)
    }

    const runtime = requireRuntimeByScope(this.options.registry, scope)
    if (runtime.cardActions.has(action.id)) {
      throw new Error(`Card action "${action.id}" is already registered by "${scope.extensionId}".`)
    }

    this.options.registry.registerCardAction(scope.extensionId, action)

    const request = this.options.rpc.requestMain(
      'contributions.cardActions.register',
      {
        runtimeHandle: scope.runtimeHandle,
        action: toCardActionRegistrationRpcInput(action)
      },
      this.options.getRequestOptions(scope)
    )
    const registration = createContributionRegistration({
      scope,
      label: `Card action contribution "${action.id}"`,
      mainRegistration: request,
      reportDiagnostic: (diagnostic) => this.options.reportDiagnostic(scope, diagnostic),
      disposeLocal: () => {
        this.options.registry.unregisterCardAction(scope.extensionId, action.id)
      },
      unregisterMain: () =>
        this.options.rpc.requestMain(
          'contributions.cardActions.unregister',
          {
            runtimeHandle: scope.runtimeHandle,
            contributionId: action.id
          },
          this.options.getCleanupRequestOptions(scope)
        ),
      invalidateLocal: () => {
        this.options.registry.unregisterCardAction(scope.extensionId, action.id)
      },
      onSyncFailure: (error) => {
        runtime.context.logger.error(
          `Card action contribution "${action.id}" was disabled because main registry synchronization failed.`,
          error
        )
      }
    })

    this.options.trackMainRequest(scope, registration.sync)
    return registration
  }

  async run(request: ContributionScopedRpcParams, signal: AbortSignal): Promise<RpcNoPayload> {
    const runtime = this.options.registry.getByRuntimeHandle(request.runtimeHandle)
    if (!runtime) {
      throw new Error(`Extension runtime "${request.runtimeHandle}" is not active.`)
    }

    const action = runtime.cardActions.get(request.contributionId)
    if (!action) {
      throw new Error(
        `Card action "${request.contributionId}" is not registered for "${runtime.metadata.id}".`
      )
    }

    await this.options.runInExtensionContext(runtime, () => action.run(), signal)
    return {}
  }

  releaseRuntime(runtimeHandle: string): void {
    this.options.registry.getByRuntimeHandle(runtimeHandle)?.cardActions.clear()
  }

  releaseAll(): void {
    for (const runtime of this.options.registry.list()) {
      runtime.cardActions.clear()
    }
  }
}

function toCardActionRegistrationRpcInput(action: CardActionContribution) {
  return {
    id: action.id,
    label: action.label,
    description: action.description,
    order: action.order
  }
}
