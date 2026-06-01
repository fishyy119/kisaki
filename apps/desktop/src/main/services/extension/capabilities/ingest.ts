import {
  createUnavailableError,
  type ExtensionRuntimeMetadata,
  type IngestAddGameFromScraperOptions,
  type IngestAddGameFromScraperResult,
  type ScraperLookup
} from '@kisaki3/extension-api'
import type { IngestService } from '@main/services/ingest'
import type { TaskRunInitiator } from '@shared/task-run'
import type { ScraperLookup as AppScraperLookup } from '@shared/scraper'
import type {
  IngestAddGameFromScraperOptions as AppIngestAddGameFromScraperOptions,
  IngestAddGameFromScraperResult as AppIngestAddGameFromScraperResult
} from '@shared/ingest/add'

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
    options?: IngestAddGameFromScraperOptions,
    signal?: AbortSignal
  ): Promise<IngestAddGameFromScraperResult> {
    const metadata = this.requireRuntime(runtimeHandle)
    const appOptions = toAppAddGameFromScraperOptions(options)
    const result =
      options?.taskRun === false
        ? await this.options.ingest.add.game.addFromScraper(profileId, toAppScraperLookup(lookup), {
            ...appOptions,
            signal
          })
        : await this.options.ingest.add.game.addFromScraperWithTaskRun(
            profileId,
            toAppScraperLookup(lookup),
            {
              ...appOptions,
              taskRunInitiator: createExtensionTaskRunInitiator(metadata)
            }
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

function toAppAddGameFromScraperOptions(
  options: IngestAddGameFromScraperOptions | undefined
): AppIngestAddGameFromScraperOptions {
  if (!options) {
    return {}
  }

  const { taskRun: _taskRun, ...appOptions } = options
  return appOptions
}

function createExtensionTaskRunInitiator(metadata: ExtensionRuntimeMetadata): TaskRunInitiator {
  return {
    type: 'extension',
    extension: {
      id: metadata.id,
      nameSnapshot: metadata.name
    }
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
