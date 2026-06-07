import {
  createValidationError,
  measureJsonBytes,
  toJsonValue,
  type ExtensionRuntimeMetadata,
  type ExtensionTaskRunActiveListQuery,
  type ExtensionTaskRunCreateInput,
  type ExtensionTaskRunHistoryListQuery,
  type ExtensionTaskRunInitiator,
  type ExtensionTaskRunProgressPhase,
  type ExtensionTaskRunProgressUpdate,
  type ExtensionTaskRunProgressWork,
  type ExtensionTaskRunResult,
  type ExtensionTaskRunWarning
} from '@kisaki3/extension-api'
import type { CommandService } from '@main/services/command'
import type {
  TaskRunActiveListQuery,
  TaskRunHistoryListQuery,
  TaskRunInitiator,
  TaskRunPresentation,
  TaskRunProgressUpdate,
  TaskRunResult,
  TaskRunSubject
} from '@shared/task-run'
import { toInternalExtensionTaskRunOperation } from './mappers'

const MAX_OPERATION_LENGTH = 120
const MAX_TITLE_LENGTH = 160
const MAX_DESCRIPTION_LENGTH = 1000
const MAX_SUBJECT_LABEL_LENGTH = 200
const MAX_TEXT_LENGTH = 1000
const MAX_LIST_LIMIT = 100
const MAX_COUNTERS = 20
const MAX_WARNINGS = 20
const MAX_WARNING_CODE_LENGTH = 80
const MAX_WARNING_MESSAGE_LENGTH = 500
const MAX_PROGRESS_JSON_BYTES = 32 * 1024
const MAX_RESULT_JSON_BYTES = 128 * 1024

const PUBLIC_OPERATION_PATTERN = /^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)*$/
const PROGRESS_UPDATE_KEYS = new Set(['phase', 'work', 'counters', 'warnings'])
const PROGRESS_PHASE_KEYS = new Set(['key', 'label', 'current', 'total'])
const PROGRESS_WORK_KEYS = new Set(['current', 'total', 'unit', 'ratePeriod', 'indeterminate'])

type NormalizedCreateInput = {
  operation: string
  title: string
  description?: string
  initiator: TaskRunInitiator
  subject?: TaskRunSubject
  controls: {
    cancelable: boolean
    pausable: boolean
  }
  presentation?: TaskRunPresentation
}

export function normalizeCreateInput(
  input: ExtensionTaskRunCreateInput,
  metadata: ExtensionRuntimeMetadata,
  command: CommandService
) {
  if (!isPlainObject(input)) {
    throw createValidationError('Task run create input must be an object.')
  }

  const normalized: NormalizedCreateInput = {
    operation: normalizeOperation(input.operation),
    title: normalizeRequiredText(input.title, 'Task run title', MAX_TITLE_LENGTH),
    initiator: normalizeInitiator(input.initiator, metadata),
    controls: {
      cancelable: input.controls?.cancelable === true,
      pausable: input.controls?.pausable === true
    }
  }

  const description = normalizeOptionalText(
    input.description,
    'Task run description',
    MAX_DESCRIPTION_LENGTH
  )
  const subject = normalizeSubject(input.subject, metadata, command)
  const presentation = normalizePresentation(input.presentation)

  if (description !== undefined) {
    normalized.description = description
  }
  if (subject !== undefined) {
    normalized.subject = subject
  }
  if (presentation !== undefined) {
    normalized.presentation = presentation
  }

  assertJsonWithinLimit(normalized, MAX_RESULT_JSON_BYTES, 'Task run create input')
  return normalized
}

export function normalizeProgressUpdate(
  update: ExtensionTaskRunProgressUpdate
): TaskRunProgressUpdate {
  if (!isPlainObject(update as unknown)) {
    throw createValidationError('Task run progress update must be an object.')
  }

  assertKnownKeys(update as Record<string, unknown>, PROGRESS_UPDATE_KEYS, 'Task run progress')

  const normalized: TaskRunProgressUpdate = {}
  const phase = normalizeProgressPhase(update.phase)
  const work = normalizeProgressWork(update.work)
  const counters = normalizeCounters(update.counters)
  const warnings = normalizeWarnings(update.warnings)

  if (phase !== undefined) {
    normalized.phase = phase
  }
  if (work !== undefined) {
    normalized.work = work
  }
  if (counters !== undefined) {
    normalized.counters = counters
  }
  if (warnings !== undefined) {
    normalized.warnings = warnings
  }

  assertJsonWithinLimit(normalized, MAX_PROGRESS_JSON_BYTES, 'Task run progress')
  return normalized
}

function normalizeProgressPhase(
  phase: ExtensionTaskRunProgressPhase | undefined
): TaskRunProgressUpdate['phase'] | undefined {
  if (phase === undefined) {
    return undefined
  }

  if (!isPlainObject(phase)) {
    throw createValidationError('Task run progress phase must be an object.')
  }

  assertKnownKeys(phase, PROGRESS_PHASE_KEYS, 'Task run progress phase')

  const current = normalizeOptionalPositiveInteger(phase.current, 'Task run phase current')
  const total = normalizeOptionalPositiveInteger(phase.total, 'Task run phase total')
  if (current !== undefined && total !== undefined && current > total) {
    throw createValidationError('Task run phase current must not be greater than phase total.')
  }

  const normalized: NonNullable<TaskRunProgressUpdate['phase']> = {
    key: normalizeRequiredText(phase.key, 'Task run phase key', 120),
    label: normalizeRequiredText(phase.label, 'Task run phase label', 500)
  }
  if (current !== undefined) {
    normalized.current = current
  }
  if (total !== undefined) {
    normalized.total = total
  }
  return normalized
}

function normalizeProgressWork(
  work: ExtensionTaskRunProgressWork | undefined
): TaskRunProgressUpdate['work'] | undefined {
  if (work === undefined) {
    return undefined
  }

  if (!isPlainObject(work)) {
    throw createValidationError('Task run progress work must be an object.')
  }

  assertKnownKeys(work, PROGRESS_WORK_KEYS, 'Task run progress work')

  const normalized: NonNullable<TaskRunProgressUpdate['work']> = {}
  const current = normalizeOptionalNonNegativeNumber(work.current, 'Task run work current')
  const total = normalizeOptionalNonNegativeNumber(work.total, 'Task run work total')

  if (current !== undefined) {
    normalized.current = current
  }
  if (total !== undefined) {
    normalized.total = total
  }
  if (work.unit !== undefined) {
    normalized.unit = normalizeProgressUnit(work.unit)
  }
  if (work.ratePeriod !== undefined) {
    normalized.ratePeriod = normalizeRatePeriod(work.ratePeriod)
  }
  if (work.indeterminate !== undefined) {
    if (typeof work.indeterminate !== 'boolean') {
      throw createValidationError('Task run work indeterminate must be a boolean.')
    }
    normalized.indeterminate = work.indeterminate
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined
}

export function normalizeCompletionResult(
  result: Omit<ExtensionTaskRunResult, 'status' | 'error'> | undefined
): Omit<TaskRunResult, 'status' | 'error'> | undefined {
  if (result === undefined) {
    return undefined
  }

  if (!isPlainObject(result)) {
    throw createValidationError('Task run result must be an object.')
  }

  const normalized: Omit<TaskRunResult, 'status' | 'error'> = {}
  const title = normalizeOptionalText(result.title, 'Task run result title', MAX_TEXT_LENGTH)
  const summary = normalizeOptionalText(result.summary, 'Task run result summary', MAX_TEXT_LENGTH)
  const output =
    result.output === undefined ? undefined : toTaskRunJsonValue(result.output, 'Task run output')
  const counters = normalizeCounters(result.counters)
  const warnings = normalizeWarnings(result.warnings)

  if (title !== undefined) {
    normalized.title = title
  }
  if (summary !== undefined) {
    normalized.summary = summary
  }
  if (output !== undefined) {
    normalized.output = output
  }
  if (counters !== undefined) {
    normalized.counters = counters
  }
  if (warnings !== undefined) {
    normalized.warnings = warnings
  }

  assertJsonWithinLimit(normalized, MAX_RESULT_JSON_BYTES, 'Task run result')
  return normalized
}

export function toActiveQuery(
  extensionId: string,
  query?: ExtensionTaskRunActiveListQuery
): TaskRunActiveListQuery {
  return {
    extensionId,
    categories: ['extension'],
    operations: query?.operations?.map((operation) =>
      toInternalExtensionTaskRunOperation(extensionId, normalizeOperation(operation))
    ),
    subject: normalizeSubjectQuery(query?.subject),
    limit: normalizeListLimit(query?.limit)
  }
}

export function toHistoryQuery(
  extensionId: string,
  query?: ExtensionTaskRunHistoryListQuery
): TaskRunHistoryListQuery {
  return {
    extensionId,
    categories: ['extension'],
    statuses: query?.statuses ? [...query.statuses] : undefined,
    operations: query?.operations?.map((operation) =>
      toInternalExtensionTaskRunOperation(extensionId, normalizeOperation(operation))
    ),
    subject: normalizeSubjectQuery(query?.subject),
    limit: normalizeListLimit(query?.limit)
  }
}

function normalizeOperation(operation: unknown): string {
  const normalized = normalizeRequiredText(operation, 'Task run operation', MAX_OPERATION_LENGTH)

  if (
    !PUBLIC_OPERATION_PATTERN.test(normalized) ||
    normalized.startsWith('task.') ||
    normalized.startsWith('extension.')
  ) {
    throw createValidationError(
      'Task run operation must be an extension-local lowerCamel name or dotted lowerCamel path.'
    )
  }

  return normalized
}

function normalizeInitiator(
  initiator: ExtensionTaskRunInitiator | undefined,
  metadata: ExtensionRuntimeMetadata
): TaskRunInitiator {
  if (initiator === undefined) {
    return {
      type: 'extension',
      extension: {
        id: metadata.id,
        nameSnapshot: metadata.name
      }
    }
  }

  if (!isPlainObject(initiator)) {
    throw createValidationError('Task run initiator must be an object when provided.')
  }

  switch (initiator.type) {
    case 'user':
      return { type: 'user' }
    case 'automation':
      return normalizeAutomationInitiator(initiator.automation)
    case 'extension':
      return normalizeExtensionInitiator(initiator.extension, metadata)
    case 'system': {
      const reason = normalizeSystemReason(initiator.reason)
      return reason === undefined ? { type: 'system' } : { type: 'system', reason }
    }
    default:
      throw createValidationError(
        'Task run initiator type must be "user", "automation", "extension", or "system".'
      )
  }
}

function normalizeAutomationInitiator(
  automation: Extract<ExtensionTaskRunInitiator, { type: 'automation' }>['automation']
): TaskRunInitiator {
  if (!isPlainObject(automation)) {
    throw createValidationError('Task run automation initiator must be an object.')
  }

  return {
    type: 'automation',
    automation: {
      id: normalizeRequiredText(automation.id, 'Task run automation initiator id', 200),
      nameSnapshot: normalizeRequiredText(
        automation.nameSnapshot,
        'Task run automation initiator name',
        MAX_SUBJECT_LABEL_LENGTH
      ),
      trigger: normalizeAutomationTrigger(automation.trigger),
      attempt: normalizePositiveInteger(automation.attempt, 'Task run automation initiator attempt')
    }
  }
}

function normalizeExtensionInitiator(
  extension: Extract<ExtensionTaskRunInitiator, { type: 'extension' }>['extension'],
  metadata: ExtensionRuntimeMetadata
): TaskRunInitiator {
  if (!isPlainObject(extension)) {
    throw createValidationError('Task run extension initiator must be an object.')
  }

  const id = normalizeRequiredText(extension.id, 'Task run extension initiator id', 200)
  if (id !== metadata.id) {
    throw createValidationError('Task run extension initiator must belong to this extension.')
  }

  return {
    type: 'extension',
    extension: {
      id,
      nameSnapshot:
        normalizeOptionalText(
          extension.nameSnapshot,
          'Task run extension initiator name',
          MAX_SUBJECT_LABEL_LENGTH
        ) ?? metadata.name
    }
  }
}

function normalizeAutomationTrigger(value: unknown): 'manual' | 'startup' | 'cron' {
  if (value === 'manual' || value === 'startup' || value === 'cron') {
    return value
  }

  throw createValidationError('Task run automation initiator trigger is invalid.')
}

function normalizeSystemReason(
  value: unknown
): 'startup' | 'maintenance' | 'update' | 'shutdown' | undefined {
  if (value === undefined) {
    return undefined
  }

  if (
    value === 'startup' ||
    value === 'maintenance' ||
    value === 'update' ||
    value === 'shutdown'
  ) {
    return value
  }

  throw createValidationError('Task run system initiator reason is invalid.')
}

function normalizeSubject(
  subject: ExtensionTaskRunCreateInput['subject'],
  metadata: ExtensionRuntimeMetadata,
  command: CommandService
): TaskRunSubject | undefined {
  if (subject === undefined) {
    return undefined
  }

  if (!isPlainObject(subject)) {
    throw createValidationError('Task run subject must be an object when provided.')
  }

  const labelSnapshot = normalizeOptionalText(
    subject.labelSnapshot,
    'Task run subject label',
    MAX_SUBJECT_LABEL_LENGTH
  )

  if (subject.type === 'command') {
    const commandId = normalizeRequiredText(subject.id, 'Task run command subject id', 200)
    const descriptor = command.registry.get(commandId)
    if (!descriptor || descriptor.ownerExtensionId !== metadata.id) {
      throw createValidationError('Task run command subject must belong to this extension.')
    }

    const normalized: TaskRunSubject = {
      type: 'command',
      id: commandId
    }
    if (labelSnapshot !== undefined) {
      normalized.labelSnapshot = labelSnapshot
    }
    return normalized
  }

  if (subject.type === 'extension') {
    const id =
      subject.id === undefined
        ? metadata.id
        : normalizeRequiredText(subject.id, 'Task run extension subject id', 200)
    if (id !== metadata.id) {
      throw createValidationError('Task run extension subject must belong to this extension.')
    }

    return {
      type: 'extension',
      id,
      labelSnapshot: labelSnapshot ?? metadata.name
    }
  }

  throw createValidationError('Task run subject type must be "command" or "extension".')
}

function normalizeSubjectQuery(query: ExtensionTaskRunActiveListQuery['subject']) {
  if (query === undefined) {
    return undefined
  }

  if (!isPlainObject(query) || (query.type !== 'command' && query.type !== 'extension')) {
    throw createValidationError('Task run subject query type must be "command" or "extension".')
  }

  const normalized = {
    type: query.type,
    id: normalizeOptionalText(query.id, 'Task run subject query id', 200)
  }

  return normalized.id === undefined ? { type: normalized.type } : normalized
}

function normalizePresentation(
  input: ExtensionTaskRunCreateInput['presentation']
): TaskRunPresentation | undefined {
  if (input === undefined) {
    return undefined
  }

  if (!isPlainObject(input)) {
    throw createValidationError('Task run presentation must be an object when provided.')
  }

  if (input.notify === undefined) {
    return {}
  }

  if (!isPlainObject(input.notify)) {
    throw createValidationError('Task run notify presentation must be an object.')
  }

  const notify: NonNullable<TaskRunPresentation['notify']> = {
    enabled: input.notify.enabled === true
  }
  const title = normalizeOptionalText(input.notify.title, 'Task run notify title', MAX_TITLE_LENGTH)
  const message = normalizeOptionalText(
    input.notify.message,
    'Task run notify message',
    MAX_TEXT_LENGTH
  )

  if (input.notify.showProgress !== undefined) {
    notify.showProgress = input.notify.showProgress === true
  }
  if (input.notify.showResult !== undefined) {
    notify.showResult = input.notify.showResult === true
  }
  if (input.notify.closable !== undefined) {
    notify.closable = input.notify.closable === true
  }
  if (title !== undefined) {
    notify.title = title
  }
  if (message !== undefined) {
    notify.message = message
  }

  return {
    notify
  }
}

function normalizeCounters(
  counters: Record<string, number> | undefined
): Record<string, number> | undefined {
  if (counters === undefined) {
    return undefined
  }

  if (!isPlainObject(counters)) {
    throw createValidationError('Task run counters must be an object.')
  }

  const entries = Object.entries(counters)
  if (entries.length > MAX_COUNTERS) {
    throw createValidationError(`Task run counters must contain at most ${MAX_COUNTERS} entries.`)
  }

  const normalized: Record<string, number> = {}
  for (const [key, value] of entries) {
    if (!key || key.length > 80 || !Number.isFinite(value)) {
      throw createValidationError('Task run counters must use short keys and finite numbers.')
    }
    normalized[key] = value
  }
  return normalized
}

function normalizeRatePeriod(value: unknown): 'second' | 'minute' | 'hour' {
  if (value === 'second' || value === 'minute' || value === 'hour') {
    return value
  }

  throw createValidationError('Task run rate period must be "second", "minute", or "hour".')
}

function normalizeWarnings(
  warnings: readonly ExtensionTaskRunWarning[] | undefined
): readonly ExtensionTaskRunWarning[] | undefined {
  if (warnings === undefined) {
    return undefined
  }

  if (!Array.isArray(warnings) || warnings.length > MAX_WARNINGS) {
    throw createValidationError(`Task run warnings must contain at most ${MAX_WARNINGS} entries.`)
  }

  return warnings.map((warning) => {
    if (!isPlainObject(warning)) {
      throw createValidationError('Task run warning must be an object.')
    }

    const code = normalizeOptionalText(
      warning.code,
      'Task run warning code',
      MAX_WARNING_CODE_LENGTH
    )
    const message = normalizeRequiredText(
      warning.message,
      'Task run warning message',
      MAX_WARNING_MESSAGE_LENGTH
    )

    if (code === undefined) {
      return { message }
    }

    return { code, message }
  })
}

function normalizeListLimit(limit: number | undefined): number | undefined {
  if (limit === undefined) {
    return undefined
  }

  if (!Number.isFinite(limit) || limit <= 0) {
    throw createValidationError('Task run list limit must be a positive finite number.')
  }

  return Math.min(Math.trunc(limit), MAX_LIST_LIMIT)
}

function normalizeRequiredText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw createValidationError(`${label} must be a string.`)
  }

  const normalized = value.trim()
  if (!normalized || normalized.length > maxLength) {
    throw createValidationError(`${label} must be between 1 and ${maxLength} characters.`)
  }

  return normalized
}

function normalizeOptionalText(
  value: unknown,
  label: string,
  maxLength: number
): string | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'string') {
    throw createValidationError(`${label} must be a string when provided.`)
  }

  const normalized = value.trim()
  if (normalized.length > maxLength) {
    throw createValidationError(`${label} must be at most ${maxLength} characters.`)
  }

  return normalized || undefined
}

function normalizeOptionalNonNegativeNumber(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw createValidationError(`${label} must be a non-negative finite number.`)
  }

  return value
}

function normalizePositiveInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw createValidationError(`${label} must be a positive integer.`)
  }

  return value
}

function normalizeOptionalPositiveInteger(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined
  }

  return normalizePositiveInteger(value, label)
}

function normalizeProgressUnit(
  value: unknown
): 'item' | 'file' | 'byte' | 'entity' | 'step' | 'package' | 'request' {
  if (
    value === 'item' ||
    value === 'file' ||
    value === 'byte' ||
    value === 'entity' ||
    value === 'step' ||
    value === 'package' ||
    value === 'request'
  ) {
    return value
  }

  throw createValidationError('Task run work unit is invalid.')
}

function assertKnownKeys(
  value: Record<string, unknown>,
  knownKeys: ReadonlySet<string>,
  label: string
): void {
  const unknownKey = Object.keys(value).find((key) => !knownKeys.has(key))
  if (unknownKey) {
    throw createValidationError(`${label} contains unknown field "${unknownKey}".`)
  }
}

function assertJsonWithinLimit(value: unknown, maxBytes: number, label: string): void {
  if (measureTaskRunJsonBytes(value, label) > maxBytes) {
    throw createValidationError(`${label} is too large.`)
  }
}

function toTaskRunJsonValue(value: unknown, label: string) {
  try {
    return toJsonValue(value, label)
  } catch {
    throw createValidationError(`${label} must contain only JSON values.`)
  }
}

function measureTaskRunJsonBytes(value: unknown, label: string): number {
  try {
    return measureJsonBytes(value, label)
  } catch {
    throw createValidationError(`${label} must contain only JSON values.`)
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
