import {
  type ThemeContribution,
  type ThemeRegistration,
  validateThemeContributionShape
} from '@kisaki/extension-api'
import { requireRuntimeByScope, throwValidationIssues } from '../utils'
import type { HostContributionDomainOptions, HostContributionScope } from '../types'
import { createContributionRegistration } from '../registration'

export class HostThemeContributions {
  constructor(private readonly options: HostContributionDomainOptions) {}

  register(scope: HostContributionScope, theme: ThemeContribution): ThemeRegistration {
    const issues = validateThemeContributionShape(theme)
    if (issues.length > 0) {
      throwValidationIssues('Theme contribution', issues)
    }

    const runtime = requireRuntimeByScope(this.options.registry, scope)
    if (runtime.themes.has(theme.id)) {
      throw new Error(`Theme "${theme.id}" is already registered by "${scope.extensionId}".`)
    }

    this.options.registry.registerTheme(scope.extensionId, theme)
    const request = this.options.rpc.requestMain(
      'contributions.themes.register',
      {
        runtimeHandle: scope.runtimeHandle,
        theme
      },
      this.options.getRequestOptions(scope)
    )

    const registration = createContributionRegistration({
      scope,
      label: `Theme contribution "${theme.id}"`,
      mainRegistration: request,
      reportDiagnostic: (diagnostic) => this.options.reportDiagnostic(scope, diagnostic),
      disposeLocal: () => {
        this.options.registry.unregisterTheme(scope.extensionId, theme.id)
      },
      unregisterMain: () =>
        this.options.rpc.requestMain(
          'contributions.themes.unregister',
          {
            runtimeHandle: scope.runtimeHandle,
            themeId: theme.id
          },
          this.options.getCleanupRequestOptions(scope)
        ),
      invalidateLocal: () => {
        this.options.registry.unregisterTheme(scope.extensionId, theme.id)
      },
      onSyncFailure: (error) => {
        runtime.context.logger.error(
          `Theme contribution "${theme.id}" was disabled because main registry synchronization failed.`,
          error
        )
      }
    })
    this.options.trackMainRequest(scope, registration.sync)
    return registration
  }

  releaseRuntime(runtimeHandle: string): void {
    this.options.registry.getByRuntimeHandle(runtimeHandle)?.themes.clear()
  }

  releaseAll(): void {
    for (const runtime of this.options.registry.list()) {
      runtime.themes.clear()
    }
  }
}
