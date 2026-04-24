import type {
  CharacterScraperProviderRegistration,
  CompanyScraperProviderRegistration,
  ExtensionRuntimeHandle,
  GameScraperProviderRegistration,
  PersonScraperProviderRegistration
} from '@kisaki/extension-api'
import type { ExtensionScraperProviderInfo } from '@shared/extension'
import {
  getRuntimeContributionKey,
  requireContributionOwner,
  toContributionOwnerInfo,
  type ExtensionContributionHostOptions,
  type RuntimeContributionOwner
} from './types'

type ScraperMediaType = 'game' | 'person' | 'company' | 'character'

type ScraperProviderRegistration =
  | GameScraperProviderRegistration
  | PersonScraperProviderRegistration
  | CompanyScraperProviderRegistration
  | CharacterScraperProviderRegistration

interface ScraperRegistration {
  owner: RuntimeContributionOwner
  mediaType: ScraperMediaType
  provider: ScraperProviderRegistration
}

export class ExtensionScraperContributionHost {
  private readonly registrations = new Map<string, ScraperRegistration>()

  constructor(private readonly options: ExtensionContributionHostOptions) {}

  registerGameProvider(
    runtimeHandle: ExtensionRuntimeHandle,
    provider: GameScraperProviderRegistration
  ): void {
    this.register(runtimeHandle, 'game', provider)
  }

  unregisterGameProvider(runtimeHandle: ExtensionRuntimeHandle, providerId: string): void {
    this.unregister(runtimeHandle, 'game', providerId)
  }

  registerPersonProvider(
    runtimeHandle: ExtensionRuntimeHandle,
    provider: PersonScraperProviderRegistration
  ): void {
    this.register(runtimeHandle, 'person', provider)
  }

  unregisterPersonProvider(runtimeHandle: ExtensionRuntimeHandle, providerId: string): void {
    this.unregister(runtimeHandle, 'person', providerId)
  }

  registerCompanyProvider(
    runtimeHandle: ExtensionRuntimeHandle,
    provider: CompanyScraperProviderRegistration
  ): void {
    this.register(runtimeHandle, 'company', provider)
  }

  unregisterCompanyProvider(runtimeHandle: ExtensionRuntimeHandle, providerId: string): void {
    this.unregister(runtimeHandle, 'company', providerId)
  }

  registerCharacterProvider(
    runtimeHandle: ExtensionRuntimeHandle,
    provider: CharacterScraperProviderRegistration
  ): void {
    this.register(runtimeHandle, 'character', provider)
  }

  unregisterCharacterProvider(runtimeHandle: ExtensionRuntimeHandle, providerId: string): void {
    this.unregister(runtimeHandle, 'character', providerId)
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

  getSnapshot(): readonly ExtensionScraperProviderInfo[] {
    return [...this.registrations.values()]
      .map((registration) => ({
        ...toContributionOwnerInfo(registration.owner),
        mediaType: registration.mediaType,
        provider: registration.provider
      }))
      .sort(
        (left, right) =>
          left.mediaType.localeCompare(right.mediaType) ||
          left.provider.id.localeCompare(right.provider.id)
      )
  }

  private register(
    runtimeHandle: ExtensionRuntimeHandle,
    mediaType: ScraperMediaType,
    provider: ScraperProviderRegistration
  ): void {
    const owner = requireContributionOwner(this.options, runtimeHandle)
    this.registrations.set(getScraperKey(runtimeHandle, mediaType, provider.id), {
      owner,
      mediaType,
      provider
    })
  }

  private unregister(
    runtimeHandle: ExtensionRuntimeHandle,
    mediaType: ScraperMediaType,
    providerId: string
  ): void {
    this.registrations.delete(getScraperKey(runtimeHandle, mediaType, providerId))
  }
}

function getScraperKey(
  runtimeHandle: ExtensionRuntimeHandle,
  mediaType: ScraperMediaType,
  providerId: string
): string {
  return `${getRuntimeContributionKey(runtimeHandle, providerId)}:${mediaType}`
}
