import type { ExtensionRuntimeHandle, ThemeContribution } from '@kisaki3/extension-api'
import type { ExtensionThemeRegistrationInfo } from '@shared/extension'
import {
  getRuntimeContributionKey,
  requireContributionOwner,
  toContributionOwnerInfo,
  type ExtensionContributionReleaseDiagnostic,
  type ExtensionContributionPointOptions,
  type RuntimeContributionOwner
} from '../types'

interface ThemeRegistration {
  owner: RuntimeContributionOwner
  theme: ThemeContribution
}

export class ExtensionThemeContributionPoint {
  private readonly registrations = new Map<string, ThemeRegistration>()

  constructor(private readonly options: ExtensionContributionPointOptions) {}

  register(runtimeHandle: ExtensionRuntimeHandle, theme: ThemeContribution): void {
    const owner = requireContributionOwner(this.options, runtimeHandle)
    const key = getRuntimeContributionKey(runtimeHandle, theme.id)
    // Same policy as every other contribution point: a duplicate id within
    // one extension is a registration bug, not an update channel.
    if (this.registrations.has(key)) {
      throw new Error(`Theme "${theme.id}" is already registered by "${owner.extension.id}".`)
    }

    this.registrations.set(key, { owner, theme })
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
