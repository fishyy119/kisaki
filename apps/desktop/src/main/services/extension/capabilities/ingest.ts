import {
  ANIME_UPDATE_SURFACES,
  COMIC_UPDATE_SURFACES,
  GAME_UPDATE_SURFACES,
  NOVEL_UPDATE_SURFACES,
  CONTENT_LOCALES,
  LIBRARY_ANIME_FORMATS,
  LIBRARY_COMIC_FORMATS,
  LIBRARY_NOVEL_FORMATS,
  createUnavailableError,
  createValidationError,
  type AnimeScraperLookup,
  type ComicScraperLookup,
  type ContentLocale,
  type ExtensionRuntimeMetadata,
  type GameScraperLookup,
  type IngestAddAnimeFromScraperOptions,
  type IngestAddAnimeFromScraperResult,
  type IngestAddComicFromScraperOptions,
  type IngestAddComicFromScraperResult,
  type IngestAddGameFromScraperOptions,
  type IngestAddGameFromScraperResult,
  type IngestAddNovelFromScraperOptions,
  type IngestAddNovelFromScraperResult,
  type IngestAnimeUpdateFromScraperInput,
  type IngestComicUpdateFromScraperInput,
  type IngestGameUpdateFromScraperInput,
  type IngestNovelUpdateFromScraperInput,
  type IngestUpdateInput,
  type IngestUpdateResult,
  type IngestWarningCode,
  type MediaScraperLookup,
  type NovelScraperLookup,
  type ScraperLookup
} from '@kisaki3/extension-api'
import type { IngestService } from '@main/services/ingest'
import type { TaskRunInitiator, TaskRunStartResult } from '@shared/task-run'
import type { AnimeFormat, ComicFormat, NovelFormat, PartialDate } from '@shared/db'
import { matchesPartialDate } from '@shared/db/columns/partial-date'
import type {
  AnimeScraperLookup as AppAnimeScraperLookup,
  ComicScraperLookup as AppComicScraperLookup,
  MediaScraperLookup as AppMediaScraperLookup,
  NovelScraperLookup as AppNovelScraperLookup,
  ScraperLookup as AppScraperLookup
} from '@shared/scraper'
import type {
  IngestAddAnimeFromScraperOptions as AppIngestAddAnimeFromScraperOptions,
  IngestAddAnimeFromScraperResult as AppIngestAddAnimeFromScraperResult,
  IngestAddComicFromScraperOptions as AppIngestAddComicFromScraperOptions,
  IngestAddComicFromScraperResult as AppIngestAddComicFromScraperResult,
  IngestAddGameFromScraperOptions as AppIngestAddGameFromScraperOptions,
  IngestAddGameFromScraperResult as AppIngestAddGameFromScraperResult,
  IngestAddNovelFromScraperOptions as AppIngestAddNovelFromScraperOptions,
  IngestAddNovelFromScraperResult as AppIngestAddNovelFromScraperResult
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
    lookup: GameScraperLookup,
    options?: IngestAddGameFromScraperOptions,
    signal?: AbortSignal
  ): Promise<IngestAddGameFromScraperResult> {
    this.requireRuntime(runtimeHandle)
    readNonEmptyString(profileId, 'ingest profileId')
    const result = await this.options.ingest.add.game.addFromScraper(
      profileId,
      toAppMediaScraperLookup(lookup),
      { ...toAppAddGameFromScraperOptions(options), signal }
    )
    return toPublicIngestAddGameFromScraperResult(result)
  }

  startAddGameFromScraper(
    runtimeHandle: string,
    profileId: string,
    lookup: GameScraperLookup,
    options?: IngestAddGameFromScraperOptions
  ): TaskRunStartResult {
    const metadata = this.requireRuntime(runtimeHandle)
    readNonEmptyString(profileId, 'ingest profileId')
    return this.options.ingest.add.game.startAddFromScraper(
      profileId,
      toAppMediaScraperLookup(lookup),
      {
        ...toAppAddGameFromScraperOptions(options),
        taskRunInitiator: createExtensionTaskRunInitiator(metadata)
      }
    )
  }

  async addAnimeFromScraper(
    runtimeHandle: string,
    profileId: string,
    lookup: AnimeScraperLookup,
    options?: IngestAddAnimeFromScraperOptions,
    signal?: AbortSignal
  ): Promise<IngestAddAnimeFromScraperResult> {
    this.requireRuntime(runtimeHandle)
    readNonEmptyString(profileId, 'ingest profileId')
    const result = await this.options.ingest.add.anime.addFromScraper(
      profileId,
      toAppAnimeScraperLookup(lookup),
      { ...toAppAddAnimeFromScraperOptions(options), signal }
    )
    return toPublicIngestAddAnimeFromScraperResult(result)
  }

  startAddAnimeFromScraper(
    runtimeHandle: string,
    profileId: string,
    lookup: AnimeScraperLookup,
    options?: IngestAddAnimeFromScraperOptions
  ): TaskRunStartResult {
    const metadata = this.requireRuntime(runtimeHandle)
    readNonEmptyString(profileId, 'ingest profileId')
    return this.options.ingest.add.anime.startAddFromScraper(
      profileId,
      toAppAnimeScraperLookup(lookup),
      {
        ...toAppAddAnimeFromScraperOptions(options),
        taskRunInitiator: createExtensionTaskRunInitiator(metadata)
      }
    )
  }

  async addComicFromScraper(
    runtimeHandle: string,
    profileId: string,
    lookup: ComicScraperLookup,
    options?: IngestAddComicFromScraperOptions,
    signal?: AbortSignal
  ): Promise<IngestAddComicFromScraperResult> {
    this.requireRuntime(runtimeHandle)
    readNonEmptyString(profileId, 'ingest profileId')
    const result = await this.options.ingest.add.comic.addFromScraper(
      profileId,
      toAppComicScraperLookup(lookup),
      { ...toAppAddComicFromScraperOptions(options), signal }
    )
    return toPublicIngestAddComicFromScraperResult(result)
  }

  startAddComicFromScraper(
    runtimeHandle: string,
    profileId: string,
    lookup: ComicScraperLookup,
    options?: IngestAddComicFromScraperOptions
  ): TaskRunStartResult {
    const metadata = this.requireRuntime(runtimeHandle)
    readNonEmptyString(profileId, 'ingest profileId')
    return this.options.ingest.add.comic.startAddFromScraper(
      profileId,
      toAppComicScraperLookup(lookup),
      {
        ...toAppAddComicFromScraperOptions(options),
        taskRunInitiator: createExtensionTaskRunInitiator(metadata)
      }
    )
  }

  async addNovelFromScraper(
    runtimeHandle: string,
    profileId: string,
    lookup: NovelScraperLookup,
    options?: IngestAddNovelFromScraperOptions,
    signal?: AbortSignal
  ): Promise<IngestAddNovelFromScraperResult> {
    this.requireRuntime(runtimeHandle)
    readNonEmptyString(profileId, 'ingest profileId')
    const result = await this.options.ingest.add.novel.addFromScraper(
      profileId,
      toAppNovelScraperLookup(lookup),
      { ...toAppAddNovelFromScraperOptions(options), signal }
    )
    return toPublicIngestAddNovelFromScraperResult(result)
  }

  startAddNovelFromScraper(
    runtimeHandle: string,
    profileId: string,
    lookup: NovelScraperLookup,
    options?: IngestAddNovelFromScraperOptions
  ): TaskRunStartResult {
    const metadata = this.requireRuntime(runtimeHandle)
    readNonEmptyString(profileId, 'ingest profileId')
    return this.options.ingest.add.novel.startAddFromScraper(
      profileId,
      toAppNovelScraperLookup(lookup),
      {
        ...toAppAddNovelFromScraperOptions(options),
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
      toAppUpdateRequest(input, GAME_UPDATE_SURFACE_KEYS, toAppMediaScraperLookup),
      { signal }
    )
    return toPublicIngestUpdateResult(result)
  }

  startUpdateGameFromScraper(
    runtimeHandle: string,
    input: IngestGameUpdateFromScraperInput
  ): TaskRunStartResult {
    const metadata = this.requireRuntime(runtimeHandle)
    return this.options.ingest.update.game.startUpdateFromScraper(
      toAppUpdateRequest(input, GAME_UPDATE_SURFACE_KEYS, toAppMediaScraperLookup),
      { taskRunInitiator: createExtensionTaskRunInitiator(metadata) }
    )
  }

  async updateAnimeFromScraper(
    runtimeHandle: string,
    input: IngestAnimeUpdateFromScraperInput,
    signal?: AbortSignal
  ): Promise<IngestUpdateResult> {
    this.requireRuntime(runtimeHandle)
    const result = await this.options.ingest.update.anime.updateFromScraper(
      toAppUpdateRequest(input, ANIME_UPDATE_SURFACE_KEYS, toAppAnimeScraperLookup),
      { signal }
    )
    return toPublicIngestUpdateResult(result)
  }

  startUpdateAnimeFromScraper(
    runtimeHandle: string,
    input: IngestAnimeUpdateFromScraperInput
  ): TaskRunStartResult {
    const metadata = this.requireRuntime(runtimeHandle)
    return this.options.ingest.update.anime.startUpdateFromScraper(
      toAppUpdateRequest(input, ANIME_UPDATE_SURFACE_KEYS, toAppAnimeScraperLookup),
      { taskRunInitiator: createExtensionTaskRunInitiator(metadata) }
    )
  }

  async updateComicFromScraper(
    runtimeHandle: string,
    input: IngestComicUpdateFromScraperInput,
    signal?: AbortSignal
  ): Promise<IngestUpdateResult> {
    this.requireRuntime(runtimeHandle)
    const result = await this.options.ingest.update.comic.updateFromScraper(
      toAppUpdateRequest(input, COMIC_UPDATE_SURFACE_KEYS, toAppComicScraperLookup),
      { signal }
    )
    return toPublicIngestUpdateResult(result)
  }

  startUpdateComicFromScraper(
    runtimeHandle: string,
    input: IngestComicUpdateFromScraperInput
  ): TaskRunStartResult {
    const metadata = this.requireRuntime(runtimeHandle)
    return this.options.ingest.update.comic.startUpdateFromScraper(
      toAppUpdateRequest(input, COMIC_UPDATE_SURFACE_KEYS, toAppComicScraperLookup),
      { taskRunInitiator: createExtensionTaskRunInitiator(metadata) }
    )
  }

  async updateNovelFromScraper(
    runtimeHandle: string,
    input: IngestNovelUpdateFromScraperInput,
    signal?: AbortSignal
  ): Promise<IngestUpdateResult> {
    this.requireRuntime(runtimeHandle)
    const result = await this.options.ingest.update.novel.updateFromScraper(
      toAppUpdateRequest(input, NOVEL_UPDATE_SURFACE_KEYS, toAppNovelScraperLookup),
      { signal }
    )
    return toPublicIngestUpdateResult(result)
  }

  startUpdateNovelFromScraper(
    runtimeHandle: string,
    input: IngestNovelUpdateFromScraperInput
  ): TaskRunStartResult {
    const metadata = this.requireRuntime(runtimeHandle)
    return this.options.ingest.update.novel.startUpdateFromScraper(
      toAppUpdateRequest(input, NOVEL_UPDATE_SURFACE_KEYS, toAppNovelScraperLookup),
      { taskRunInitiator: createExtensionTaskRunInitiator(metadata) }
    )
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

function toAppAddComicFromScraperOptions(
  options: IngestAddComicFromScraperOptions | undefined
): AppIngestAddComicFromScraperOptions {
  if (options === undefined) {
    return {}
  }

  if (!isPlainRecord(options)) {
    throw createValidationError('ingest add options must be an object.')
  }

  for (const key of Object.keys(options)) {
    if (!ADD_COMIC_OPTION_KEYS.has(key)) {
      throw createValidationError(`ingest add options contain an unknown field "${key}".`)
    }
  }

  return {
    comicDirPath: readOptionalNonEmptyString(
      options.comicDirPath,
      'ingest add options.comicDirPath'
    ),
    targetCollectionId: readOptionalNonEmptyString(
      options.targetCollectionId,
      'ingest add options.targetCollectionId'
    )
  }
}

const ADD_COMIC_OPTION_KEYS = new Set<string>(['comicDirPath', 'targetCollectionId'])

function toAppAddNovelFromScraperOptions(
  options: IngestAddNovelFromScraperOptions | undefined
): AppIngestAddNovelFromScraperOptions {
  if (options === undefined) {
    return {}
  }

  if (!isPlainRecord(options)) {
    throw createValidationError('ingest add options must be an object.')
  }

  for (const key of Object.keys(options)) {
    if (!ADD_NOVEL_OPTION_KEYS.has(key)) {
      throw createValidationError(`ingest add options contain an unknown field "${key}".`)
    }
  }

  return {
    novelDirPath: readOptionalNonEmptyString(
      options.novelDirPath,
      'ingest add options.novelDirPath'
    ),
    targetCollectionId: readOptionalNonEmptyString(
      options.targetCollectionId,
      'ingest add options.targetCollectionId'
    )
  }
}

const ADD_NOVEL_OPTION_KEYS = new Set<string>(['novelDirPath', 'targetCollectionId'])

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

function toAppMediaScraperLookup(lookup: MediaScraperLookup): AppMediaScraperLookup {
  return {
    ...toAppScraperLookup(lookup),
    releaseDate: readOptionalPartialDate(lookup.releaseDate, 'ingest lookup.releaseDate')
  }
}

function toAppAnimeScraperLookup(lookup: AnimeScraperLookup): AppAnimeScraperLookup {
  return {
    ...toAppMediaScraperLookup(lookup),
    format: readOptionalAnimeFormat(lookup.format)
  }
}

function toAppComicScraperLookup(lookup: ComicScraperLookup): AppComicScraperLookup {
  return {
    ...toAppMediaScraperLookup(lookup),
    format: readOptionalComicFormat(lookup.format)
  }
}

function toAppNovelScraperLookup(lookup: NovelScraperLookup): AppNovelScraperLookup {
  return {
    ...toAppMediaScraperLookup(lookup),
    format: readOptionalNovelFormat(lookup.format)
  }
}

function readOptionalPartialDate(value: unknown, label: string): PartialDate | undefined {
  if (value === undefined) {
    return undefined
  }

  if (!matchesPartialDate(value)) {
    throw createValidationError(`${label} must be a partial date with year, month and/or day.`)
  }

  return value
}

function readOptionalAnimeFormat(value: unknown): AnimeFormat | undefined {
  return value === undefined
    ? undefined
    : readEnum(value, LIBRARY_ANIME_FORMATS, 'ingest lookup.format')
}

function readOptionalComicFormat(value: unknown): ComicFormat | undefined {
  return value === undefined
    ? undefined
    : readEnum(value, LIBRARY_COMIC_FORMATS, 'ingest lookup.format')
}

function readOptionalNovelFormat(value: unknown): NovelFormat | undefined {
  return value === undefined
    ? undefined
    : readEnum(value, LIBRARY_NOVEL_FORMATS, 'ingest lookup.format')
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

/** Validates one media update input against its per-kind surface whitelist. */
function toAppUpdateRequest<TSurface extends string, TLookup extends ScraperLookup, TAppLookup>(
  input: IngestUpdateInput<TSurface, TLookup>,
  surfaceKeys: ReadonlySet<string>,
  toLookup: (lookup: TLookup) => TAppLookup
): {
  rootId: string
  profileId: string
  lookup: TAppLookup
  selection: { surfaces: TSurface[] }
  policy: { singularUpdate: 'ifMissing' | 'overwrite'; collectionUpdate: 'merge' | 'replace' }
} {
  if (!isPlainRecord(input)) {
    throw createValidationError('ingest update input must be an object with a lookup.')
  }

  if (!isPlainRecord(input.selection) || !isPlainRecord(input.policy)) {
    throw createValidationError('ingest update input must declare a selection and a policy.')
  }

  return {
    rootId: readNonEmptyString(input.rootId, 'ingest update input.rootId'),
    profileId: readNonEmptyString(input.profileId, 'ingest update input.profileId'),
    lookup: toLookup(input.lookup),
    selection: {
      surfaces: readUpdateSurfaces<TSurface>(input.selection.surfaces, surfaceKeys)
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
const ANIME_UPDATE_SURFACE_KEYS = new Set<string>(
  ANIME_UPDATE_SURFACES.map((surface) => surface.key)
)
const COMIC_UPDATE_SURFACE_KEYS = new Set<string>(
  COMIC_UPDATE_SURFACES.map((surface) => surface.key)
)
const NOVEL_UPDATE_SURFACE_KEYS = new Set<string>(
  NOVEL_UPDATE_SURFACES.map((surface) => surface.key)
)

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

function readUpdateSurfaces<TSurface extends string>(
  value: unknown,
  surfaceKeys: ReadonlySet<string>
): TSurface[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw createValidationError('ingest update selection.surfaces must be a non-empty array.')
  }

  return value.map((surface, index) => {
    if (typeof surface !== 'string' || !surfaceKeys.has(surface)) {
      throw createValidationError(
        `ingest update selection.surfaces[${index}] must be a known update surface.`
      )
    }

    return surface as TSurface
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

function toPublicIngestUpdateResult(result: {
  warnings?: readonly { code: IngestWarningCode; message: string }[]
}): IngestUpdateResult {
  return {
    warnings: result.warnings?.map((warning) => ({
      code: warning.code,
      message: warning.message
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

function toPublicIngestAddComicFromScraperResult(
  result: AppIngestAddComicFromScraperResult
): IngestAddComicFromScraperResult {
  return {
    comicId: result.comicId,
    isNew: result.isNew,
    existingReason: result.existingReason,
    warnings: result.warnings?.map((warning) => ({
      code: warning.code,
      message: warning.message
    }))
  }
}

function toPublicIngestAddNovelFromScraperResult(
  result: AppIngestAddNovelFromScraperResult
): IngestAddNovelFromScraperResult {
  return {
    novelId: result.novelId,
    isNew: result.isNew,
    existingReason: result.existingReason,
    warnings: result.warnings?.map((warning) => ({
      code: warning.code,
      message: warning.message
    }))
  }
}
