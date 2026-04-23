import type { SerializableRecord } from './serialization'
import type { ValidationIssue } from './validation'
import {
  isPlainObject,
  validateOptionalString,
  validateRequiredString,
  validateSerializableRecord,
  validateUnknownKeys
} from './validation'

const EXTENSION_ERROR_KEYS = new Set<string>(['code', 'message', 'details'])

const DEFAULT_CONFLICT_CODES = ['SQLITE_CONSTRAINT'] as const

export type ExtensionErrorCode =
  | 'validation_failure'
  | 'not_found'
  | 'conflict'
  | 'timeout'
  | 'unavailable'
  | 'internal'
  | 'method_not_found'
  | (string & {})

export type ExtensionCapabilityErrorCode = ExtensionErrorCode

export interface ExtensionErrorShape {
  code?: string
  message: string
  details?: SerializableRecord
}

export interface ValidateExtensionErrorShapeOptions {
  allowedKeys?: ReadonlySet<string>
  path?: string
}

export interface ExtensionErrorOptions {
  code?: ExtensionErrorCode
  details?: SerializableRecord
  exposeStack?: boolean
}

export interface NormalizeExtensionErrorOptions {
  conflictCodes?: readonly string[]
  conflictMessage?: string
  timeoutMessage?: string
}

export class ExtensionError extends Error {
  readonly name = 'ExtensionError'
  readonly code?: string
  readonly details?: SerializableRecord
  readonly exposeStack: boolean

  constructor(message: string, options: ExtensionErrorOptions = {}) {
    super(message)
    this.code = options.code
    this.details = options.details
    this.exposeStack = options.exposeStack ?? false
  }
}

export { ExtensionError as ExtensionCapabilityError }

export function validateExtensionErrorShape(
  value: unknown,
  options: ValidateExtensionErrorShapeOptions = {}
): ValidationIssue[] {
  const path = options.path ?? '$'
  const allowedKeys = options.allowedKeys ?? EXTENSION_ERROR_KEYS
  const issues: ValidationIssue[] = []

  if (!isPlainObject(value)) {
    return [{ path, message: 'Error must be an object.' }]
  }

  issues.push(
    ...validateUnknownKeys(value, allowedKeys, path),
    ...validateOptionalString(value.code, `${path}.code`, {
      minLength: 1,
      typeMessage: 'code must be a string when provided.',
      valueMessage: 'code must be a non-empty string when provided.',
      trim: true
    }),
    ...validateRequiredString(value.message, `${path}.message`, {
      trim: true,
      valueMessage: 'message must be a non-empty string.'
    })
  )

  if (value.details !== undefined) {
    issues.push(...validateSerializableRecord(value.details, `${path}.details`))
  }

  return issues
}

export function isExtensionErrorShape(value: unknown): value is ExtensionErrorShape {
  return validateExtensionErrorShape(value).length === 0
}

export function createExtensionError(
  message: string,
  options: ExtensionErrorOptions = {}
): ExtensionError {
  return new ExtensionError(message, options)
}

export function createValidationError(
  message: string,
  details?: SerializableRecord
): ExtensionError {
  return createExtensionError(message, {
    code: 'validation_failure',
    details
  })
}

export function createNotFoundError(message: string, details?: SerializableRecord): ExtensionError {
  return createExtensionError(message, {
    code: 'not_found',
    details
  })
}

export function createConflictError(message: string, details?: SerializableRecord): ExtensionError {
  return createExtensionError(message, {
    code: 'conflict',
    details
  })
}

export function createTimeoutError(message: string, details?: SerializableRecord): ExtensionError {
  return createExtensionError(message, {
    code: 'timeout',
    details
  })
}

export function createUnavailableError(
  message: string,
  details?: SerializableRecord
): ExtensionError {
  return createExtensionError(message, {
    code: 'unavailable',
    details
  })
}

export function createInternalError(message: string, details?: SerializableRecord): ExtensionError {
  return createExtensionError(message, {
    code: 'internal',
    details
  })
}

export function normalizeExtensionError(
  error: unknown,
  fallbackMessage: string,
  options: NormalizeExtensionErrorOptions = {}
): ExtensionError {
  if (error instanceof ExtensionError) {
    return error
  }

  if (error instanceof Error) {
    const code = readErrorCode(error)

    if (matchesErrorCode(code, options.conflictCodes ?? DEFAULT_CONFLICT_CODES)) {
      return createConflictError(
        options.conflictMessage ?? 'The requested library change conflicts with existing data.'
      )
    }

    if (isAbortLikeError(error)) {
      return createTimeoutError(options.timeoutMessage ?? 'The host capability request timed out.')
    }
  }

  return createInternalError(fallbackMessage)
}

export const normalizeCapabilityError = normalizeExtensionError

export function ensureNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createValidationError(`${label} must be a non-empty string.`)
  }
}

export function readErrorCode(error: unknown): string | undefined {
  return error instanceof Error && typeof (error as Error & { code?: unknown }).code === 'string'
    ? (error as Error & { code: string }).code
    : undefined
}

export function readErrorDetails(error: unknown): SerializableRecord | undefined {
  if (!(error instanceof Error) || !('details' in error)) {
    return undefined
  }

  const details = (error as Error & { details?: unknown }).details
  return validateSerializableRecord(details).length === 0
    ? (details as SerializableRecord)
    : undefined
}

function isAbortLikeError(error: Error): boolean {
  return error.name === 'AbortError' || /timeout/i.test(error.message)
}

function matchesErrorCode(code: string | undefined, patterns: readonly string[]): boolean {
  if (!code) {
    return false
  }

  return patterns.some((pattern) => code === pattern || code.startsWith(`${pattern}_`))
}
