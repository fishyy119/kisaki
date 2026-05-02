import { type ThemeContribution, validateThemeContributionShape } from '@kisaki/extension-api'
import {
  createContributionDisposable,
  requireRuntimeByScope,
  throwValidationIssues,
  type ContributionDisposable,
  type HostContributionDomainOptions,
  type HostContributionScope
} from './types'

export class HostThemeContributions {
  constructor(private readonly options: HostContributionDomainOptions) {}

  register(scope: HostContributionScope, theme: ThemeContribution): ContributionDisposable {
    const issues = validateThemeContributionShape(theme)
    if (issues.length > 0) {
      throwValidationIssues('Theme contribution', issues)
    }

    const runtime = requireRuntimeByScope(this.options.registry, scope)
    if (runtime.themes.has(theme.id)) {
      throw new Error(`Theme "${theme.id}" is already registered by "${scope.extensionId}".`)
    }

    this.options.registry.registerTheme(scope.extensionId, theme)
    this.options.trackMainRequest(
      scope,
      this.options.rpc.requestMain(
        'contributions.themes.register',
        {
          runtimeHandle: scope.runtimeHandle,
          theme
        },
        this.options.getRequestOptions(scope)
      )
    )

    return createContributionDisposable(async () => {
      this.options.registry.unregisterTheme(scope.extensionId, theme.id)
      await this.options.rpc.requestMain(
        'contributions.themes.unregister',
        {
          runtimeHandle: scope.runtimeHandle,
          themeId: theme.id
        },
        this.options.getCleanupRequestOptions(scope)
      )
    })
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
