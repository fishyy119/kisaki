import {
  createUnavailableError,
  type ExtensionRuntimeMetadata,
  type ScraperProfileListQuery,
  type ScraperProfileSummary
} from '@kisaki/extension-api'
import type { ScraperService } from '@main/services/scraper'
import type { ScraperProfileSummary as AppScraperProfileSummary } from '@shared/scraper'

export interface ExtensionScrapersCapabilityProviderOptions {
  scraper: ScraperService
  resolveRuntimeHandle(runtimeHandle: string): ExtensionRuntimeMetadata | null | undefined
}

export class ExtensionScrapersCapabilityProvider {
  constructor(private readonly options: ExtensionScrapersCapabilityProviderOptions) {}

  listProfiles(runtimeHandle: string, query?: ScraperProfileListQuery): ScraperProfileSummary[] {
    this.requireRuntime(runtimeHandle)
    return this.options.scraper.profiles
      .list(query ? { mediaType: query.mediaType } : undefined)
      .map((profile) => toPublicScraperProfileSummary(profile))
  }

  getProfile(runtimeHandle: string, profileId: string): ScraperProfileSummary | null {
    this.requireRuntime(runtimeHandle)
    const profile = this.options.scraper.profiles.get(profileId)
    return profile ? toPublicScraperProfileSummary(profile) : null
  }

  private requireRuntime(runtimeHandle: string): ExtensionRuntimeMetadata {
    const metadata = this.options.resolveRuntimeHandle(runtimeHandle)
    if (!metadata) {
      throw createUnavailableError(`Runtime handle "${runtimeHandle}" is not active.`)
    }

    return metadata
  }
}

function toPublicScraperProfileSummary(profile: AppScraperProfileSummary): ScraperProfileSummary {
  return {
    id: profile.id,
    name: profile.name,
    description: profile.description,
    mediaType: profile.mediaType,
    searchProviderId: profile.searchProviderId,
    defaultLocale: profile.defaultLocale,
    providerSlots: profile.providerSlots.map((slot) => ({
      slot: slot.slot,
      providerIds: [...slot.providerIds]
    }))
  }
}
