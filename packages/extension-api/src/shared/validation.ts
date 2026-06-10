/**
 * Issue reported by boundary validation helpers, located by a JSONPath-like path.
 */
export interface ValidationIssue {
  path: string
  message: string
}

interface StringValidationOptions {
  minLength?: number
  trim?: boolean
  typeMessage?: string
  valueMessage?: string
}

interface ArrayValidationOptions {
  minLength?: number
  typeMessage?: string
  valueMessage?: string
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function prefixIssues(
  prefix: string,
  issues: readonly ValidationIssue[]
): ValidationIssue[] {
  return issues.map((issue) => ({
    path: issue.path === '$' ? prefix : `${prefix}${issue.path.slice(1)}`,
    message: issue.message
  }))
}

export function validateUnknownKeys(
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
  basePath = '$'
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      issues.push({
        path: `${basePath}.${key}`,
        message: 'Unknown field.'
      })
    }
  }

  return issues
}

export function validateRequiredString(
  value: unknown,
  path: string,
  options: StringValidationOptions = {}
): ValidationIssue[] {
  if (typeof value !== 'string') {
    return [
      {
        path,
        message: options.typeMessage ?? 'Field must be a string.'
      }
    ]
  }

  const normalized = options.trim ? value.trim() : value
  const minLength = options.minLength ?? 1

  if (normalized.length < minLength) {
    return [
      {
        path,
        message: options.valueMessage ?? 'Field must be a non-empty string.'
      }
    ]
  }

  return []
}

export function validateOptionalString(
  value: unknown,
  path: string,
  options: StringValidationOptions = {}
): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  return validateRequiredString(value, path, {
    ...options,
    minLength: options.minLength ?? 0
  })
}

export function validateRequiredBoolean(value: unknown, path: string): ValidationIssue[] {
  if (typeof value === 'boolean') {
    return []
  }

  return [{ path, message: 'Field must be a boolean.' }]
}

export function validateOptionalBoolean(value: unknown, path: string): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  return validateRequiredBoolean(value, path)
}

export function validateRequiredFiniteNumber(
  value: unknown,
  path: string,
  message = 'Field must be a finite number.'
): ValidationIssue[] {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return []
  }

  return [{ path, message }]
}

export function validateOptionalFiniteNumber(
  value: unknown,
  path: string,
  message = 'Field must be a finite number when provided.'
): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  return validateRequiredFiniteNumber(value, path, message)
}

export function validateRequiredFunction(value: unknown, path: string): ValidationIssue[] {
  if (typeof value === 'function') {
    return []
  }

  return [{ path, message: 'Field must be a function.' }]
}

export function validateOptionalFunction(value: unknown, path: string): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  return validateRequiredFunction(value, path)
}

export function validateRequiredArray(
  value: unknown,
  path: string,
  options: ArrayValidationOptions = {}
): ValidationIssue[] {
  if (!Array.isArray(value)) {
    return [
      {
        path,
        message: options.typeMessage ?? 'Field must be an array.'
      }
    ]
  }

  const minLength = options.minLength ?? 0
  if (value.length < minLength) {
    return [
      {
        path,
        message: options.valueMessage ?? `Array must contain at least ${minLength} item(s).`
      }
    ]
  }

  return []
}

export function validateRequiredEnumString<TValue extends string>(
  value: unknown,
  path: string,
  allowedValues: readonly TValue[],
  message: string
): ValidationIssue[] {
  if (typeof value !== 'string') {
    return [{ path, message }]
  }

  if (allowedValues.includes(value as TValue)) {
    return []
  }

  return [{ path, message }]
}

export function validateOptionalEnumString<TValue extends string>(
  value: unknown,
  path: string,
  allowedValues: readonly TValue[],
  message: string
): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  return validateRequiredEnumString(value, path, allowedValues, message)
}

export function isAbortSignal(value: unknown): value is AbortSignal {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as AbortSignal).aborted === 'boolean' &&
    typeof (value as AbortSignal).addEventListener === 'function' &&
    typeof (value as AbortSignal).removeEventListener === 'function'
  )
}
