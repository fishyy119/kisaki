import {
  createUnavailableError,
  type ExtensionRuntimeMetadata,
  type IngestAddGameFromScraperOptions,
  type IngestAddGameFromScraperResult,
  type IngestGameUpdateFromScraperInput,
  type IngestGameUpdateFromScraperOptions,
  type IngestUpdateResult,
  type ScraperLookup
} from '@kisaki3/extension-api'
import type { IngestService } from '@main/services/ingest'
import type { TaskRunInitiator } from '@shared/task-run'
import type { ScraperLookup as AppScraperLookup } from '@shared/scraper'
import type { GameUpdateRequest } from '@shared/ingest/update'
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

  async updateGameFromScraper(
    runtimeHandle: string,
    input: IngestGameUpdateFromScraperInput,
    options?: IngestGameUpdateFromScraperOptions,
    signal?: AbortSignal
  ): Promise<IngestUpdateResult> {
    const metadata = this.requireRuntime(runtimeHandle)
    const request = toAppGameUpdateRequest(input)
    const result =
      options?.taskRun === false
        ? await this.options.ingest.update.game.updateFromScraper(request, { signal })
        : await this.options.ingest.update.game.updateFromScraperWithTaskRun(request, {
            taskRunInitiator: createExtensionTaskRunInitiator(metadata)
          })

    return {
      warnings: result.warnings?.map((warning) => ({
        code: warning.code,
        message: warning.message
      }))
    }
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

function toAppGameUpdateRequest(input: IngestGameUpdateFromScraperInput): GameUpdateRequest {
  return {
    rootId: input.rootId,
    profileId: input.profileId,
    lookup: {
      name: input.lookup.name,
      knownIds: input.lookup.knownIds.map((knownId) => ({
        source: knownId.source,
        id: knownId.id
      }))
    },
    selection: {
      surfaces: [...input.selection.surfaces]
    },
    policy: {
      singularUpdate: input.policy.singularUpdate,
      collectionUpdate: input.policy.collectionUpdate
    }
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
