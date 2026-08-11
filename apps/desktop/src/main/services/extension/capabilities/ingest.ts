import {
  GAME_UPDATE_SURFACES,
  CONTENT_LOCALES,
  createUnavailableError,
  createValidationError,
  type ContentLocale,
  type ExtensionRuntimeMetadata,
  type GameUpdateSurface,
  type IngestAddAnimeFromScraperOptions,
  type IngestAddAnimeFromScraperResult,
  type IngestAddGameFromScraperOptions,
  type IngestAddGameFromScraperResult,
  type IngestGameUpdateFromScraperInput,
  type IngestUpdateResult,
  type ScraperLookup
} from '@kisaki3/extension-api'
import type { IngestService } from '@main/services/ingest'
import type { TaskRunInitiator, TaskRunStartResult } from '@shared/task-run'
import type { ScraperLookup as AppScraperLookup } from '@shared/scraper'
import type { GameUpdateRequest } from '@shared/ingest/update'
import type {
  IngestAddAnimeFromScraperOptions as AppIngestAddAnimeFromScraperOptions,
  IngestAddAnimeFromScraperResult as AppIngestAddAnimeFromScraperResult,
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
    this.requireRuntime(runtimeHandle)
    readNonEmptyString(profileId, 'ingest profileId')
    const result = await this.options.ingest.add.game.addFromScraper(
      profileId,
      toAppScraperLookup(lookup),
      { ...toAppAddGameFromScraperOptions(options), signal }
    )
    return toPublicIngestAddGameFromScraperResult(result)
  }

  startAddGameFromScraper(
    runtimeHandle: string,
    profileId: string,
    lookup: ScraperLookup,
    options?: IngestAddGameFromScraperOptions
  ): TaskRunStartResult {
    const metadata = this.requireRuntime(runtimeHandle)
    readNonEmptyString(profileId, 'ingest profileId')
    return this.options.ingest.add.game.startAddFromScraper(profileId, toAppScraperLookup(lookup), {
      ...toAppAddGameFromScraperOptions(options),
      taskRunInitiator: createExtensionTaskRunInitiator(metadata)
    })
  }

  async addAnimeFromScraper(
    runtimeHandle: string,
    profileId: string,
    lookup: ScraperLookup,
    options?: IngestAddAnimeFromScraperOptions,
    signal?: AbortSignal
  ): Promise<IngestAddAnimeFromScraperResult> {
    this.requireRuntime(runtimeHandle)
    readNonEmptyString(profileId, 'ingest profileId')
    const result = await this.options.ingest.add.anime.addFromScraper(
      profileId,
      toAppScraperLookup(lookup),
      { ...toAppAddAnimeFromScraperOptions(options), signal }
    )
    return toPublicIngestAddAnimeFromScraperResult(result)
  }

  startAddAnimeFromScraper(
    runtimeHandle: string,
    profileId: string,
    lookup: ScraperLookup,
    options?: IngestAddAnimeFromScraperOptions
  ): TaskRunStartResult {
    const metadata = this.requireRuntime(runtimeHandle)
    readNonEmptyString(profileId, 'ingest profileId')
    return this.options.ingest.add.anime.startAddFromScraper(
      profileId,
      toAppScraperLookup(lookup),
      {
        ...toAppAddAnimeFromScraperOptions(options),
        taskRunInitiator: createExtensionTaskRunInitiator(metadata)
      }
    )
  }

  async updateGameFromScraper(
    runtimeHandle: string,
    input: IngestGameUpdateFromScraperInput,
    signal?: AbortSignal
  ): Promise<IngestUpdateResult> {
    this.requireRuntime(runtimeHandle)
    const result = await this.options.ingest.update.game.updateFromScraper(
      toAppGameUpdateRequest(input),
      { signal }
    )

    return {
      warnings: result.warnings?.map((warning) => ({
        code: warning.code,
        message: warning.message
      }))
    }
  }

  startUpdateGameFromScraper(
    runtimeHandle: string,
    input: IngestGameUpdateFromScraperInput
  ): TaskRunStartResult {
    const metadata = this.requireRuntime(runtimeHandle)
    return this.options.ingest.update.game.startUpdateFromScraper(toAppGameUpdateRequest(input), {
      taskRunInitiator: createExtensionTaskRunInitiator(metadata)
    })
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
  if (options === undefined) {
    return {}
  }

  if (!isPlainRecord(options)) {
    throw createValidationError('ingest add options must be an object.')
  }

  for (const key of Object.keys(options)) {
    if (!ADD_GAME_OPTION_KEYS.has(key)) {
      throw createValidationError(`ingest add options contain an unknown field "${key}".`)
    }
  }

  return {
    gameDirPath: readOptionalNonEmptyString(options.gameDirPath, 'ingest add options.gameDirPath'),
    gameFilePath: readOptionalNonEmptyString(
      options.gameFilePath,
      'ingest add options.gameFilePath'
    ),
    targetCollectionId: readOptionalNonEmptyString(
      options.targetCollectionId,
      'ingest add options.targetCollectionId'
    )
  }
}

const ADD_GAME_OPTION_KEYS = new Set<string>(['gameDirPath', 'gameFilePath', 'targetCollectionId'])

function toAppAddAnimeFromScraperOptions(
  options: IngestAddAnimeFromScraperOptions | undefined
): AppIngestAddAnimeFromScraperOptions {
  if (options === undefined) {
    return {}
  }

  if (!isPlainRecord(options)) {
    throw createValidationError('ingest add options must be an object.')
  }

  for (const key of Object.keys(options)) {
    if (!ADD_ANIME_OPTION_KEYS.has(key)) {
      throw createValidationError(`ingest add options contain an unknown field "${key}".`)
    }
  }

  return {
    animeDirPath: readOptionalNonEmptyString(
      options.animeDirPath,
      'ingest add options.animeDirPath'
    ),
    targetCollectionId: readOptionalNonEmptyString(
      options.targetCollectionId,
      'ingest add options.targetCollectionId'
    )
  }
}

const ADD_ANIME_OPTION_KEYS = new Set<string>(['animeDirPath', 'targetCollectionId'])

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
  if (!isPlainRecord(lookup)) {
    throw createValidationError('ingest lookup must be an object.')
  }

  return {
    name: readNonEmptyString(lookup.name, 'ingest lookup.name'),
    locale: readOptionalLocale(lookup.locale),
    knownIds: lookup.knownIds === undefined ? undefined : readKnownIds(lookup.knownIds)
  }
}

function readOptionalLocale(value: unknown): ContentLocale | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'string' || !(CONTENT_LOCALES as readonly string[]).includes(value)) {
    throw createValidationError(
      `ingest lookup.locale must be one of: ${CONTENT_LOCALES.join(', ')}.`
    )
  }

  return value as ContentLocale
}

function toAppGameUpdateRequest(input: IngestGameUpdateFromScraperInput): GameUpdateRequest {
  if (!isPlainRecord(input) || !isPlainRecord(input.lookup)) {
    throw createValidationError('ingest update input must be an object with a lookup.')
  }

  if (!isPlainRecord(input.selection) || !isPlainRecord(input.policy)) {
    throw createValidationError('ingest update input must declare a selection and a policy.')
  }

  return {
    rootId: readNonEmptyString(input.rootId, 'ingest update input.rootId'),
    profileId: readNonEmptyString(input.profileId, 'ingest update input.profileId'),
    lookup: {
      name: readNonEmptyString(input.lookup.name, 'ingest update lookup.name'),
      knownIds: readKnownIds(input.lookup.knownIds)
    },
    selection: {
      surfaces: readUpdateSurfaces(input.selection.surfaces)
    },
    policy: {
      singularUpdate: readEnum(
        input.policy.singularUpdate,
        ['ifMissing', 'overwrite'],
        'ingest update policy.singularUpdate'
      ),
      collectionUpdate: readEnum(
        input.policy.collectionUpdate,
        ['merge', 'replace'],
        'ingest update policy.collectionUpdate'
      )
    }
  }
}

const GAME_UPDATE_SURFACE_KEYS = new Set<string>(GAME_UPDATE_SURFACES.map((surface) => surface.key))

function readKnownIds(value: unknown): { source: string; id: string }[] {
  if (!Array.isArray(value)) {
    throw createValidationError('ingest lookup.knownIds must be an array.')
  }

  return value.map((knownId, index) => {
    if (!isPlainRecord(knownId)) {
      throw createValidationError(`ingest lookup.knownIds[${index}] must be an object.`)
    }

    return {
      source: readNonEmptyString(knownId.source, `ingest lookup.knownIds[${index}].source`),
      id: readNonEmptyString(knownId.id, `ingest lookup.knownIds[${index}].id`)
    }
  })
}

function readUpdateSurfaces(value: unknown): GameUpdateSurface[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw createValidationError('ingest update selection.surfaces must be a non-empty array.')
  }

  return value.map((surface, index) => {
    if (typeof surface !== 'string' || !GAME_UPDATE_SURFACE_KEYS.has(surface)) {
      throw createValidationError(
        `ingest update selection.surfaces[${index}] must be a known update surface.`
      )
    }

    return surface as GameUpdateSurface
  })
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw createValidationError(`${label} must be one of: ${allowed.join(', ')}.`)
  }

  return value as T
}

function readNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createValidationError(`${label} must be a non-empty string.`)
  }

  return value
}

function readOptionalNonEmptyString(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : readNonEmptyString(value, label)
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
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

function toPublicIngestAddAnimeFromScraperResult(
  result: AppIngestAddAnimeFromScraperResult
): IngestAddAnimeFromScraperResult {
  return {
    animeId: result.animeId,
    isNew: result.isNew,
    existingReason: result.existingReason,
    warnings: result.warnings?.map((warning) => ({
      code: warning.code,
      message: warning.message
    }))
  }
}
