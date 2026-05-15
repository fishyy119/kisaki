/**
 * Base database columns and Drizzle custom types
 *
 * Contains the base column definitions and all Drizzle customType implementations
 * for SQLite JSON serialization/deserialization.
 */

import { text, integer, customType } from 'drizzle-orm/sqlite-core'
import { nanoid } from 'nanoid'

import {
  MEDIA_TYPES,
  CONTENT_ENTITY_TYPES,
  ALL_ENTITY_TYPES,
  type MediaType,
  type ContentEntityType,
  type AllEntityType
} from '../common'
import { LOCALES, APP_LOCALES, type Locale, type AppLocale } from '../locale'
import {
  parseExtensionInstallationSource,
  type ExtensionInstallationSource
} from '../extension/installation-source'
import {
  parseExtensionRegistryManifest,
  type ExtensionRegistryManifest
} from '@kisaki/extension-registry'

import type {
  Status,
  GameLauncherMode,
  GameMonitorMode,
  Gender,
  GamePersonType,
  GameCharacterType,
  GameCompanyType,
  CharacterPersonType,
  BloodType,
  CupSize,
  MainWindowCloseAction,
  ScannerIngestMode
} from './enums'
import {
  SCANNER_INGEST_MODE_VALUES,
  SCANNER_PARALLEL_COUNT_DEFAULT,
  SCANNER_PARALLEL_COUNT_MAX,
  SCANNER_PARALLEL_COUNT_MIN
} from './constants'
import type {
  BackgroundTaskCreatedBy,
  BackgroundTaskFailurePolicy,
  BackgroundTaskRunRecord,
  BackgroundTaskSchedule
} from '../background-task'

import type {
  RelatedSite,
  SaveBackup,
  FailedScan,
  ScannerIgnoredNames,
  NameExtractionRule,
  PartialDate,
  FilterState,
  DynamicCollectionConfig,
  ScraperSlotConfigs,
  SectionLayout,
  SectionItemSize,
  SectionOpenMode,
  SortDirection
} from './json-types'

const PARTIAL_DATE_KEYS = new Set(['year', 'month', 'day'])

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

function isPartialDate(value: unknown): value is PartialDate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const record = value as Record<string, unknown>
  const keys = Object.keys(record)

  if (keys.length === 0) {
    return false
  }

  if (keys.some((key) => !PARTIAL_DATE_KEYS.has(key))) {
    return false
  }

  const hasYear = 'year' in record
  const hasMonth = 'month' in record
  const hasDay = 'day' in record

  if (hasYear && hasDay && !hasMonth) {
    return false
  }

  if (hasYear && !isInteger(record.year)) {
    return false
  }

  if (hasMonth && !isInteger(record.month)) {
    return false
  }

  if (hasDay && !isInteger(record.day)) {
    return false
  }

  return true
}

function normalizePartialDate(value: PartialDate | null | undefined): PartialDate | null {
  if (!isPartialDate(value)) {
    return null
  }

  const normalized: PartialDate = {}
  if (value.year !== undefined) {
    normalized.year = value.year
  }
  if (value.month !== undefined) {
    normalized.month = value.month
  }
  if (value.day !== undefined) {
    normalized.day = value.day
  }
  return normalized
}

// =============================================================================
// Base Columns
// =============================================================================

export const baseColumns = {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
}

// =============================================================================
// Enum Type Factories
// =============================================================================

/**
 * Creates a Drizzle custom type for required enum values
 *
 * @param validValues - Array of valid enum string values
 * @param defaultValue - Fallback value when reading invalid data from DB
 * @param typeName - Human-readable name for error messages
 */
function createEnumType<T extends string>(
  validValues: readonly T[],
  defaultValue: T,
  typeName: string
) {
  return customType<{ data: T; driverData: string }>({
    dataType() {
      return 'text'
    },

    fromDriver(value: string): T {
      if (validValues.includes(value as T)) {
        return value as T
      }
      return defaultValue
    },

    toDriver(value: T): string {
      if (validValues.includes(value)) {
        return value
      }
      throw new Error(`Invalid ${typeName} value: ${value}`)
    }
  })
}

/**
 * Creates a Drizzle custom type for nullable enum values
 *
 * @param validValues - Array of valid enum string values
 * @param typeName - Human-readable name for error messages
 */
function createNullableEnumType<T extends string>(validValues: readonly T[], typeName: string) {
  return customType<{ data: T | null; driverData: string | null }>({
    dataType() {
      return 'text'
    },

    fromDriver(value: string | null): T | null {
      if (!value) return null
      if (validValues.includes(value as T)) {
        return value as T
      }
      return null
    },

    toDriver(value: T | null): string | null {
      if (!value) return null
      if (validValues.includes(value)) {
        return value
      }
      throw new Error(`Invalid ${typeName} value: ${value}`)
    }
  })
}

/**
 * Creates a Drizzle custom type for required bounded integers.
 *
 * Values read from the database fall back to defaultValue when invalid or out of range.
 * Values written through Drizzle must already be valid.
 */
export function createBoundedIntegerType(
  min: number,
  max: number,
  defaultValue: number,
  typeName: string
) {
  return customType<{ data: number; driverData: number }>({
    dataType() {
      return 'integer'
    },

    fromDriver(value: number): number {
      if (Number.isInteger(value) && value >= min && value <= max) {
        return value
      }

      return defaultValue
    },

    toDriver(value: number): number {
      if (Number.isInteger(value) && value >= min && value <= max) {
        return value
      }

      throw new Error(`Invalid ${typeName} value: ${value}`)
    }
  })
}

// =============================================================================
// Enum Custom Types (using factories)
// =============================================================================

const STATUS_VALUES = [
  'notStarted',
  'inProgress',
  'partial',
  'completed',
  'multiple',
  'shelved'
] as const
export const status = createEnumType<Status>(STATUS_VALUES, 'notStarted', 'status')

const GAME_LAUNCHER_MODE_VALUES = ['file', 'url', 'exec'] as const
export const gameLauncherMode = createEnumType<GameLauncherMode>(
  GAME_LAUNCHER_MODE_VALUES,
  'file',
  'gameLauncherMode'
)

const GAME_MONITOR_MODE_VALUES = ['file', 'folder', 'process'] as const
export const gameMonitorMode = createEnumType<GameMonitorMode>(
  GAME_MONITOR_MODE_VALUES,
  'folder',
  'gameMonitorMode'
)

const GENDER_VALUES = ['male', 'female', 'other'] as const
export const gender = createNullableEnumType<Gender>(GENDER_VALUES, 'gender')

const GAME_PERSON_TYPE_VALUES = [
  'director',
  'scenario',
  'illustration',
  'music',
  'programmer',
  'actor',
  'other'
] as const
export const gamePersonType = createEnumType<GamePersonType>(
  GAME_PERSON_TYPE_VALUES,
  'other',
  'gamePersonType'
)

const GAME_CHARACTER_TYPE_VALUES = ['main', 'supporting', 'cameo', 'other'] as const
export const gameCharacterType = createEnumType<GameCharacterType>(
  GAME_CHARACTER_TYPE_VALUES,
  'other',
  'gameCharacterType'
)

const GAME_COMPANY_TYPE_VALUES = ['developer', 'publisher', 'distributor', 'other'] as const
export const gameCompanyType = createEnumType<GameCompanyType>(
  GAME_COMPANY_TYPE_VALUES,
  'other',
  'gameCompanyType'
)

const CHARACTER_PERSON_TYPE_VALUES = ['actor', 'illustration', 'designer', 'other'] as const
export const characterPersonType = createEnumType<CharacterPersonType>(
  CHARACTER_PERSON_TYPE_VALUES,
  'other',
  'characterPersonType'
)

const BLOOD_TYPE_VALUES = ['a', 'b', 'ab', 'o'] as const
export const bloodType = createNullableEnumType<BloodType>(BLOOD_TYPE_VALUES, 'bloodType')

const CUP_SIZE_VALUES = [
  'aaa',
  'aa',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k'
] as const
export const cupSize = createNullableEnumType<CupSize>(CUP_SIZE_VALUES, 'cupSize')

export const mediaType = createEnumType<MediaType>(MEDIA_TYPES, 'game', 'mediaType')
export const locale = createNullableEnumType<Locale>(LOCALES, 'locale')
export const appLocale = createNullableEnumType<AppLocale>(APP_LOCALES, 'appLocale')

const MAIN_WINDOW_CLOSE_ACTION_VALUES = ['exit', 'tray'] as const
export const mainWindowCloseAction = createEnumType<MainWindowCloseAction>(
  MAIN_WINDOW_CLOSE_ACTION_VALUES,
  'exit',
  'mainWindowCloseAction'
)

export const scannerIngestMode = createEnumType<ScannerIngestMode>(
  SCANNER_INGEST_MODE_VALUES,
  'prefer-scraper',
  'scannerIngestMode'
)
export const scannerParallelCount = createBoundedIntegerType(
  SCANNER_PARALLEL_COUNT_MIN,
  SCANNER_PARALLEL_COUNT_MAX,
  SCANNER_PARALLEL_COUNT_DEFAULT,
  'scannerParallelCount'
)
export const contentEntityType = createEnumType<ContentEntityType>(
  CONTENT_ENTITY_TYPES,
  'game',
  'contentEntityType'
)
export const allEntityType = createEnumType<AllEntityType>(
  ALL_ENTITY_TYPES,
  'game',
  'allEntityType'
)

const SECTION_LAYOUT_VALUES = ['horizontal', 'grid'] as const
export const sectionLayout = createEnumType<SectionLayout>(
  SECTION_LAYOUT_VALUES,
  'horizontal',
  'sectionLayout'
)

const SECTION_ITEM_SIZE_VALUES = ['xs', 'sm', 'md', 'lg', 'xl'] as const
export const sectionItemSize = createEnumType<SectionItemSize>(
  SECTION_ITEM_SIZE_VALUES,
  'md',
  'sectionItemSize'
)

const SECTION_OPEN_MODE_VALUES = ['page', 'dialog'] as const
export const sectionOpenMode = createEnumType<SectionOpenMode>(
  SECTION_OPEN_MODE_VALUES,
  'page',
  'sectionOpenMode'
)

const SORT_DIRECTION_VALUES = ['asc', 'desc'] as const
export const sortDirection = createEnumType<SortDirection>(
  SORT_DIRECTION_VALUES,
  'asc',
  'sortDirection'
)

const BACKGROUND_TASK_CREATED_BY_VALUES = ['user', 'extension'] as const
export const backgroundTaskCreatedBy = createEnumType<BackgroundTaskCreatedBy>(
  BACKGROUND_TASK_CREATED_BY_VALUES,
  'user',
  'backgroundTaskCreatedBy'
)

export const EXTENSION_REPOSITORY_STATE_VALUES = ['enabled', 'disabled'] as const
export type ExtensionRepositoryState = (typeof EXTENSION_REPOSITORY_STATE_VALUES)[number]
export const extensionRepositoryState = createEnumType<ExtensionRepositoryState>(
  EXTENSION_REPOSITORY_STATE_VALUES,
  'disabled',
  'extensionRepositoryState'
)

export const EXTENSION_INSTALL_REASON_VALUES = ['manual', 'update', 'local-file'] as const
export type ExtensionInstallReason = (typeof EXTENSION_INSTALL_REASON_VALUES)[number]
export const extensionInstallReason = createEnumType<ExtensionInstallReason>(
  EXTENSION_INSTALL_REASON_VALUES,
  'manual',
  'extensionInstallReason'
)

export const EXTENSION_UPDATE_POLICY_VALUES = ['manual', 'notify', 'auto', 'pinned'] as const
export type ExtensionUpdatePolicy = (typeof EXTENSION_UPDATE_POLICY_VALUES)[number]
export const extensionUpdatePolicy = createEnumType<ExtensionUpdatePolicy>(
  EXTENSION_UPDATE_POLICY_VALUES,
  'manual',
  'extensionUpdatePolicy'
)

export const EXTENSION_SIGNER_ALGORITHM_VALUES = ['ed25519'] as const
export type ExtensionSignerAlgorithm = (typeof EXTENSION_SIGNER_ALGORITHM_VALUES)[number]
export const extensionSignerAlgorithm = createEnumType<ExtensionSignerAlgorithm>(
  EXTENSION_SIGNER_ALGORITHM_VALUES,
  'ed25519',
  'extensionSignerAlgorithm'
)

// =============================================================================
// Partial Date Custom Type
// =============================================================================

/** Custom type for storing partial date JSON object. */
export const partialDate = customType<{
  data: PartialDate | null
  driverData: string | null
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string | null): PartialDate | null {
    if (!value) return null
    try {
      const parsed = JSON.parse(value)
      const normalized = normalizePartialDate(parsed)
      return normalized
    } catch {
      return null
    }
  },

  toDriver(value: PartialDate | null): string | null {
    if (!value) return null
    const normalized = normalizePartialDate(value)
    if (!normalized) {
      throw new Error('partialDate must be a valid PartialDate object or null')
    }
    return JSON.stringify(normalized)
  }
})

// =============================================================================
// Array/Object JSON Custom Types
// =============================================================================

/** Custom type for storing string array as JSON in SQLite */
export const stringArrayJson = customType<{
  data: string[]
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): string[] {
    if (!value || value === '[]') return []
    try {
      const parsed = JSON.parse(value)
      if (!Array.isArray(parsed)) {
        return []
      }
      return parsed.filter((v) => typeof v === 'string') as string[]
    } catch {
      return []
    }
  },

  toDriver(value: string[]): string {
    if (!Array.isArray(value)) {
      throw new Error('stringArrayJson must be an array')
    }
    if (!value.every((v) => typeof v === 'string')) {
      throw new Error('stringArrayJson must be an array of strings')
    }
    return JSON.stringify(value)
  }
})

/** Custom type for storing RelatedSite array as JSON in SQLite */
export const relatedSites = customType<{
  data: RelatedSite[]
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): RelatedSite[] {
    if (!value || value === '[]') return []

    try {
      const parsed = JSON.parse(value)
      if (!Array.isArray(parsed)) {
        return []
      }

      const validated = parsed.filter((item): item is RelatedSite => {
        if (!item || typeof item !== 'object') return false
        if (typeof item.label !== 'string' || !item.label.trim()) return false
        if (typeof item.url !== 'string' || !item.url.trim()) return false
        try {
          new URL(item.url)
          return true
        } catch {
          return false
        }
      })

      return validated
    } catch {
      return []
    }
  },

  toDriver(value: RelatedSite[]): string {
    if (!Array.isArray(value)) {
      throw new Error('RelatedSites must be an array')
    }

    const errors: string[] = []
    value.forEach((site, index) => {
      if (!site || typeof site !== 'object') {
        errors.push(`Site at index ${index} is not an object`)
        return
      }
      if (typeof site.label !== 'string' || !site.label.trim()) {
        errors.push(`Site at index ${index} has invalid label`)
      }
      if (typeof site.url !== 'string' || !site.url.trim()) {
        errors.push(`Site at index ${index} has invalid url`)
      } else {
        try {
          new URL(site.url)
        } catch {
          errors.push(`Site at index ${index} has invalid URL format: ${site.url}`)
        }
      }
    })

    if (errors.length > 0) {
      throw new Error(`RelatedSites validation failed:\n${errors.join('\n')}`)
    }

    const uniqueSites = Array.from(new Map(value.map((site) => [site.url, site])).values())
    return JSON.stringify(uniqueSites)
  }
})

/** Custom type for storing SaveBackup array as JSON in SQLite */
export const saveBackups = customType<{
  data: SaveBackup[]
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): SaveBackup[] {
    if (!value || value === '[]') return []
    try {
      const parsed = JSON.parse(value)
      if (!Array.isArray(parsed)) {
        return []
      }
      return parsed.filter(
        (item): item is SaveBackup =>
          item &&
          typeof item === 'object' &&
          typeof item.backupAt === 'number' &&
          typeof item.note === 'string' &&
          typeof item.locked === 'boolean' &&
          typeof item.saveFile === 'string'
      )
    } catch {
      return []
    }
  },

  toDriver(value: SaveBackup[]): string {
    if (!Array.isArray(value)) {
      throw new Error('SaveBackups must be an array')
    }
    value.forEach((item, index) => {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof item.backupAt !== 'number' ||
        typeof item.note !== 'string' ||
        typeof item.locked !== 'boolean' ||
        typeof item.saveFile !== 'string'
      ) {
        throw new Error(`Invalid saveBackup object at index ${index}`)
      }
    })
    return JSON.stringify(value)
  }
})

/** Custom type for storing FailedScan array as JSON in SQLite */
export const failedScans = customType<{
  data: FailedScan[]
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): FailedScan[] {
    if (!value || value === '[]') return []
    try {
      const parsed = JSON.parse(value)
      if (!Array.isArray(parsed)) {
        return []
      }
      return parsed.filter(
        (item): item is FailedScan =>
          item &&
          typeof item === 'object' &&
          typeof item.name === 'string' &&
          typeof item.reason === 'string' &&
          typeof item.path === 'string'
      )
    } catch {
      return []
    }
  },

  toDriver(value: FailedScan[]): string {
    if (!Array.isArray(value)) {
      throw new Error('FailedScans must be an array')
    }
    value.forEach((item, index) => {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof item.name !== 'string' ||
        typeof item.reason !== 'string' ||
        typeof item.path !== 'string'
      ) {
        throw new Error(`Invalid failedScan object at index ${index}`)
      }
    })
    return JSON.stringify(value)
  }
})

/** Custom type for storing scanner ignored names as JSON in SQLite */
export const scannerIgnoredNames = customType<{
  data: ScannerIgnoredNames
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): ScannerIgnoredNames {
    if (!value || value === '[]') return []
    try {
      const parsed = JSON.parse(value)
      if (!Array.isArray(parsed)) {
        return []
      }
      return parsed.filter((item): item is string => typeof item === 'string')
    } catch {
      return []
    }
  },

  toDriver(value: ScannerIgnoredNames): string {
    if (!Array.isArray(value)) {
      throw new Error('scannerIgnoredNames must be an array')
    }
    value.forEach((item, index) => {
      if (typeof item !== 'string') {
        throw new Error(`Invalid scannerIgnoredName at index ${index}`)
      }
    })
    return JSON.stringify(value)
  }
})

/** Custom type for storing name extraction rules as JSON in SQLite */
export const nameExtractionRules = customType<{
  data: NameExtractionRule[]
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): NameExtractionRule[] {
    if (!value || value === '[]') return []
    try {
      const parsed = JSON.parse(value)
      if (!Array.isArray(parsed)) {
        return []
      }
      return parsed.filter(
        (item): item is NameExtractionRule =>
          item &&
          typeof item === 'object' &&
          typeof item.id === 'string' &&
          typeof item.description === 'string' &&
          typeof item.pattern === 'string' &&
          typeof item.enabled === 'boolean'
      )
    } catch {
      return []
    }
  },

  toDriver(value: NameExtractionRule[]): string {
    if (!Array.isArray(value)) {
      throw new Error('nameExtractionRules must be an array')
    }
    return JSON.stringify(value)
  }
})

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isBackgroundTaskSchedule(value: unknown): value is BackgroundTaskSchedule {
  if (!isPlainObject(value) || typeof value.type !== 'string') return false

  switch (value.type) {
    case 'manual':
    case 'onStartup':
      return true
    case 'interval':
      return typeof value.everyMs === 'number' && Number.isFinite(value.everyMs)
    case 'daily':
      return typeof value.timeOfDay === 'string'
    case 'weekly':
      return typeof value.dayOfWeek === 'number' && typeof value.timeOfDay === 'string'
    default:
      return false
  }
}

function isBackgroundTaskFailurePolicy(value: unknown): value is BackgroundTaskFailurePolicy {
  if (!isPlainObject(value) || typeof value.type !== 'string') return false

  switch (value.type) {
    case 'none':
      return true
    case 'retry':
      return typeof value.retryCount === 'number'
    case 'pauseTask':
      return value.retryCount === undefined || typeof value.retryCount === 'number'
    default:
      return false
  }
}

const BACKGROUND_TASK_RUN_STATUSES = new Set(['success', 'failed', 'cancelled', 'skipped'])
const BACKGROUND_TASK_RUN_TRIGGERS = new Set(['manual', 'startup', 'schedule'])

function isBackgroundTaskRunRecord(value: unknown): value is BackgroundTaskRunRecord {
  if (!isPlainObject(value)) return false

  const error = value.error
  return (
    typeof value.id === 'string' &&
    typeof value.taskId === 'string' &&
    typeof value.commandId === 'string' &&
    typeof value.startedAt === 'number' &&
    typeof value.finishedAt === 'number' &&
    typeof value.attempt === 'number' &&
    typeof value.status === 'string' &&
    BACKGROUND_TASK_RUN_STATUSES.has(value.status) &&
    typeof value.trigger === 'string' &&
    BACKGROUND_TASK_RUN_TRIGGERS.has(value.trigger) &&
    (error === undefined || typeof error === 'string')
  )
}

function parseJsonValue(value: string | null): unknown {
  if (value === null || value === '') return null
  return JSON.parse(value)
}

export const backgroundTaskArgs = customType<{
  data: Record<string, unknown>
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): Record<string, unknown> {
    try {
      const parsed = parseJsonValue(value)
      return isPlainObject(parsed) ? parsed : {}
    } catch {
      return {}
    }
  },

  toDriver(value: Record<string, unknown>): string {
    if (!isPlainObject(value)) {
      throw new Error('backgroundTaskArgs must be an object')
    }
    return JSON.stringify(value)
  }
})

export const backgroundTaskSchedule = customType<{
  data: BackgroundTaskSchedule
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): BackgroundTaskSchedule {
    try {
      const parsed = parseJsonValue(value)
      return isBackgroundTaskSchedule(parsed) ? parsed : { type: 'manual' }
    } catch {
      return { type: 'manual' }
    }
  },

  toDriver(value: BackgroundTaskSchedule): string {
    if (!isBackgroundTaskSchedule(value)) {
      throw new Error('backgroundTaskSchedule must be a valid schedule')
    }
    return JSON.stringify(value)
  }
})

export const backgroundTaskFailurePolicy = customType<{
  data: BackgroundTaskFailurePolicy
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): BackgroundTaskFailurePolicy {
    try {
      const parsed = parseJsonValue(value)
      return isBackgroundTaskFailurePolicy(parsed) ? parsed : { type: 'none' }
    } catch {
      return { type: 'none' }
    }
  },

  toDriver(value: BackgroundTaskFailurePolicy): string {
    if (!isBackgroundTaskFailurePolicy(value)) {
      throw new Error('backgroundTaskFailurePolicy must be a valid failure policy')
    }
    return JSON.stringify(value)
  }
})

export const backgroundTaskHistory = customType<{
  data: BackgroundTaskRunRecord[]
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): BackgroundTaskRunRecord[] {
    try {
      const parsed = parseJsonValue(value)
      return Array.isArray(parsed) ? parsed.filter(isBackgroundTaskRunRecord) : []
    } catch {
      return []
    }
  },

  toDriver(value: BackgroundTaskRunRecord[]): string {
    if (!Array.isArray(value) || !value.every(isBackgroundTaskRunRecord)) {
      throw new Error('backgroundTaskHistory must be an array of run records')
    }
    return JSON.stringify(value)
  }
})

export const extensionRegistryManifestSnapshot = customType<{
  data: ExtensionRegistryManifest | null
  driverData: string | null
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string | null): ExtensionRegistryManifest | null {
    if (!value) return null
    try {
      const parsed = JSON.parse(value)
      const manifest = parsePersistedExtensionRegistryManifestSnapshot(parsed)
      return manifest
    } catch {
      return null
    }
  },

  toDriver(value: ExtensionRegistryManifest | null): string | null {
    if (value === null || value === undefined) return null
    const manifest = parsePersistedExtensionRegistryManifestSnapshot(value)
    if (!manifest) {
      throw new Error('extensionRegistryManifestSnapshot must be a valid registry manifest or null')
    }
    return JSON.stringify(manifest)
  }
})

export const extensionInstallationSource = customType<{
  data: ExtensionInstallationSource | null
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): ExtensionInstallationSource | null {
    try {
      const parsed = JSON.parse(value)
      const source = parseExtensionInstallationSource(parsed)
      return source
    } catch {
      return null
    }
  },

  toDriver(value: ExtensionInstallationSource | null): string {
    const source = parseExtensionInstallationSource(value)
    if (!source) {
      throw new Error('extensionInstallationSource must be a valid installation source')
    }
    return JSON.stringify(source)
  }
})

function parsePersistedExtensionRegistryManifestSnapshot(
  value: unknown
): ExtensionRegistryManifest | null {
  // Persistence parsing preserves development snapshots; main-process repository
  // services enforce the current runtime URL policy before catalog/install use.
  const result = parseExtensionRegistryManifest(value, { allowInsecureLocalUrls: true })
  if (result.manifest) {
    return result.manifest
  }

  return null
}

function normalizeFilterValueForStorage(value: unknown): FilterState[string] | undefined {
  if (value === undefined || value === null) return undefined

  if (value === true) return true
  if (value === false) return undefined

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed : undefined
  }

  if (Array.isArray(value)) {
    const strings = value
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim())
      .filter(Boolean)
    return strings.length > 0 ? strings : undefined
  }

  if (!isPlainObject(value)) return undefined

  // Relation
  if ('match' in value && 'ids' in value) {
    const match = value.match
    const ids = value.ids
    if (match !== 'any' && match !== 'all') return undefined
    if (!Array.isArray(ids)) return undefined
    const normalizedIds = ids
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim())
      .filter(Boolean)
    return normalizedIds.length > 0
      ? ({ match, ids: normalizedIds } as FilterState[string])
      : undefined
  }

  // Number range
  if ('min' in value || 'max' in value) {
    const min = value.min
    const max = value.max
    const normalizedMin = typeof min === 'number' ? min : undefined
    const normalizedMax = typeof max === 'number' ? max : undefined
    return normalizedMin === undefined && normalizedMax === undefined
      ? undefined
      : ({ min: normalizedMin, max: normalizedMax } as FilterState[string])
  }

  // Date range
  if ('from' in value || 'to' in value) {
    const from = typeof value.from === 'string' && value.from.trim() ? value.from.trim() : undefined
    const to = typeof value.to === 'string' && value.to.trim() ? value.to.trim() : undefined
    return from || to ? ({ from, to } as FilterState[string]) : undefined
  }

  return undefined
}

/** Custom type for storing filter state as JSON in SQLite */
export const filterState = customType<{
  data: FilterState
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): FilterState {
    if (!value || value === '{}' || value === 'null') return {}
    try {
      const parsed = JSON.parse(value)
      if (!isPlainObject(parsed)) {
        return {}
      }

      const record = parsed as Record<string, unknown>
      const normalized: Record<string, FilterState[string]> = {}
      for (const [key, rawValue] of Object.entries(record)) {
        const normalizedValue = normalizeFilterValueForStorage(rawValue)
        if (normalizedValue !== undefined) {
          normalized[key] = normalizedValue
        }
      }
      return normalized
    } catch {
      return {}
    }
  },

  toDriver(value: FilterState): string {
    if (!isPlainObject(value)) {
      throw new Error('filterState must be an object')
    }
    for (const [key, rawValue] of Object.entries(value)) {
      const normalizedValue = normalizeFilterValueForStorage(rawValue)
      if (normalizedValue === undefined) {
        throw new Error(`Invalid filterState value for key: ${key}`)
      }
    }
    return JSON.stringify(value)
  }
})

/** Custom type for storing dynamic collection config as JSON in SQLite */
export const dynamicCollectionConfig = customType<{
  data: DynamicCollectionConfig | null
  driverData: string | null
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string | null): DynamicCollectionConfig | null {
    if (!value) return null
    try {
      const parsed = JSON.parse(value)
      if (typeof parsed !== 'object' || parsed === null) {
        return null
      }
      return parsed as DynamicCollectionConfig
    } catch {
      return null
    }
  },

  toDriver(value: DynamicCollectionConfig | null): string | null {
    if (value === null || value === undefined) return null
    if (typeof value !== 'object') {
      throw new Error('dynamicCollectionConfig must be an object or null')
    }
    return JSON.stringify(value)
  }
})

// No legacy filter conversion is supported.

// =============================================================================
// Scraper Profile Custom Types
// =============================================================================

/** Custom type for storing scraper slot configs as JSON in SQLite */
export const scraperSlotConfigs = customType<{
  data: ScraperSlotConfigs
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): ScraperSlotConfigs {
    if (!value || value === '{}') return {}
    try {
      const parsed = JSON.parse(value)
      if (!isPlainObject(parsed)) {
        return {}
      }
      return parsed as ScraperSlotConfigs
    } catch {
      return {}
    }
  },

  toDriver(value: ScraperSlotConfigs): string {
    if (typeof value !== 'object' || value === null) {
      throw new Error('scraperSlotConfigs must be an object')
    }
    return JSON.stringify(value)
  }
})
