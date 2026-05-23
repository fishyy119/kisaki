import type { ExtensionRuntimeHandle, ThemeContribution } from '@kisaki3/extension-api'
import type { ExtensionThemeRegistrationInfo } from '@shared/extension'
import {
  getRuntimeContributionKey,
  requireContributionOwner,
  toContributionOwnerInfo,
  type ExtensionContributionReleaseDiagnostic,
  type ExtensionContributionDomainOptions,
  type RuntimeContributionOwner
} from '../types'

interface ThemeRegistration {
  owner: RuntimeContributionOwner
  theme: ThemeContribution
}

export class ExtensionThemeContributionPoint {
  private readonly registrations = new Map<string, ThemeRegistration>()

  constructor(private readonly options: ExtensionContributionDomainOptions) {}

  register(runtimeHandle: ExtensionRuntimeHandle, theme: ThemeContribution): void {
    const owner = requireContributionOwner(this.options, runtimeHandle)
    this.registrations.set(getRuntimeContributionKey(runtimeHandle, theme.id), {
      owner,
      theme
    })
  }

  unregister(runtimeHandle: ExtensionRuntimeHandle, themeId: string): void {
    this.registrations.delete(getRuntimeContributionKey(runtimeHandle, themeId))
  }

  releaseRuntime(runtimeHandle: ExtensionRuntimeHandle): void {
    for (const [key, registration] of [...this.registrations]) {
      if (registration.owner.runtimeHandle === runtimeHandle) {
        this.registrations.delete(key)
      }
    }
  }

  releaseAll(): void {
    this.registrations.clear()
  }

  getSnapshot(): readonly ExtensionThemeRegistrationInfo[] {
    return [...this.registrations.values()]
      .map((registration) => ({
        ...toContributionOwnerInfo(registration.owner),
        theme: registration.theme
      }))
      .sort((left, right) => left.theme.id.localeCompare(right.theme.id))
  }

  getReleaseDiagnostics(extensionId: string): readonly ExtensionContributionReleaseDiagnostic[] {
    return [...this.registrations.values()]
      .filter((registration) => registration.owner.extension.id === extensionId)
      .map((registration) => ({
        domain: 'themes',
        detail: registration.theme.id
      }))
  }
}
