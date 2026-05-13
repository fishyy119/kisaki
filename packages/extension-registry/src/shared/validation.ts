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
    return [{ path, message: options.typeMessage ?? 'Field must be a string.' }]
  }

  const normalized = options.trim ? value.trim() : value
  const minLength = options.minLength ?? 1

  if (normalized.length < minLength) {
    return [{ path, message: options.valueMessage ?? 'Field must be a non-empty string.' }]
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

export function validateRequiredArray(
  value: unknown,
  path: string,
  options: ArrayValidationOptions = {}
): ValidationIssue[] {
  if (!Array.isArray(value)) {
    return [{ path, message: options.typeMessage ?? 'Field must be an array.' }]
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
  if (typeof value === 'string' && allowedValues.includes(value as TValue)) {
    return []
  }

  return [{ path, message }]
}
