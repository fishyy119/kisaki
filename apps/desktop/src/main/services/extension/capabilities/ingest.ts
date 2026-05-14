import {
  createUnavailableError,
  type ExtensionRuntimeMetadata,
  type IngestAddGameFromScraperOptions,
  type IngestAddGameFromScraperResult,
  type ScraperLookup
} from '@kisaki/extension-api'
import type { IngestService } from '@main/services/ingest'
import type { ScraperLookup as AppScraperLookup } from '@shared/scraper'
import type { IngestAddGameFromScraperResult as AppIngestAddGameFromScraperResult } from '@shared/ingest/add'

export interface ExtensionIngestCapabilityProviderOptions {
  ingest: IngestService
  resolveRuntimeHandle(runtimeHandle: string): ExtensionRuntimeMetadata | null | undefined
}

export class ExtensionIngestCapabilityProvider {
  constructor(private readonly options: ExtensionIngestCapabilityProviderOptions) {}

  async addGameFromScraper(
    runtimeHandle: string,
    profileId: string,
    lookup: ScraperLookup,
    options?: IngestAddGameFromScraperOptions
  ): Promise<IngestAddGameFromScraperResult> {
    this.requireRuntime(runtimeHandle)
    const result = await this.options.ingest.add.game.fromScraper(
      profileId,
      toAppScraperLookup(lookup),
      options
    )
    return toPublicIngestAddGameFromScraperResult(result)
  }

  private requireRuntime(runtimeHandle: string): ExtensionRuntimeMetadata {
    const metadata = this.options.resolveRuntimeHandle(runtimeHandle)
    if (!metadata) {
      throw createUnavailableError(`Runtime handle "${runtimeHandle}" is not active.`)
    }

    return metadata
  }
}

function toAppScraperLookup(lookup: ScraperLookup): AppScraperLookup {
  return {
    name: lookup.name,
    locale: lookup.locale,
    knownIds: lookup.knownIds?.map((knownId) => ({
      source: knownId.source,
      id: knownId.id
    }))
  }
}

function toPublicIngestAddGameFromScraperResult(
  result: AppIngestAddGameFromScraperResult
): IngestAddGameFromScraperResult {
  return {
    gameId: result.gameId,
    isNew: result.isNew,
    existingReason: result.existingReason,
    warnings: result.warnings?.map((warning) => ({
      code: warning.code,
      message: warning.message
    }))
  }
}
