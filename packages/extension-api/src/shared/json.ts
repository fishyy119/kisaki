import type { ValidationIssue } from './validation'

export type JsonPrimitive = string | number | boolean | null

export type JsonArray = readonly JsonValue[]

export type JsonValue = JsonPrimitive | JsonArray | { readonly [key: string]: JsonValue }

export interface JsonObject {
  readonly [key: string]: JsonValue
}

interface JsonSerializationState {
  readonly label: string
  readonly seen: Set<object>
}

/**
 * Normalizes an untrusted value into the strict JSON data model.
 * @remarks Deep-copies onto null-prototype records: drops `undefined` object
 * properties, converts array holes and `undefined` entries to `null`, and
 * rejects non-finite numbers, circular references, and non-plain values
 * (Date, Map, Set, class instances, functions; `toJSON` is not honored).
 * @param label - Prefix used in error messages to locate the offending path.
 * @throws Error when the value cannot be represented as JSON.
 */
export function toJsonValue(value: unknown, label = 'value'): JsonValue {
  return serializeJsonValue(value, '', {
    label,
    seen: new Set<object>()
  })
}

/**
 * Normalizes an untrusted value like {@link toJsonValue} and requires the root
 * to be a JSON object.
 * @throws Error when the value is not a JSON object.
 */
export function toJsonObject(value: unknown, label = 'value'): JsonObject {
  const normalized = toJsonValue(value, label)
  if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) {
    throw new Error(`${label} must be a JSON object.`)
  }

  return normalized as JsonObject
}

/**
 * Measures the UTF-8 byte size of the normalized JSON encoding of a value.
 * @throws Error when the value cannot be represented as JSON.
 */
export function measureJsonBytes(value: unknown, label = 'value'): number {
  return new TextEncoder().encode(JSON.stringify(toJsonValue(value, label))).byteLength
}

/**
 * Collects the issues that prevent a value from being a strict JSON value.
 * @returns An empty array when the value already satisfies {@link JsonValue}.
 */
export function validateJsonValue(value: unknown, path = '$'): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  visitJsonValue(value, path, issues, new Set<object>(), true)
  return issues
}

/**
 * Collects the issues that prevent a value from being a strict JSON object.
 * @returns An empty array when the value already satisfies {@link JsonObject}.
 */
export function validateJsonObject(value: unknown, path = '$'): ValidationIssue[] {
  if (!isPlainRecord(value)) {
    return [{ path, message: 'Field must be an object containing JSON values.' }]
  }

  return validateJsonValue(value, path)
}

function serializeJsonValue(
  value: unknown,
  path: string,
  state: JsonSerializationState
): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`${formatLocation(state.label, path)} number values must be finite.`)
    }

    return value
  }

  if (Array.isArray(value)) {
    if (state.seen.has(value)) {
      throw new Error(`${formatLocation(state.label, path)} must not contain circular references.`)
    }

    state.seen.add(value)
    try {
      const items: JsonValue[] = []
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index) || value[index] === undefined) {
          items.push(null)
          continue
        }

        items.push(serializeJsonValue(value[index], `${path}[${index}]`, state))
      }
      return items
    } finally {
      state.seen.delete(value)
    }
  }

  if (isPlainRecord(value)) {
    if (state.seen.has(value)) {
      throw new Error(`${formatLocation(state.label, path)} must not contain circular references.`)
    }

    state.seen.add(value)
    try {
      const record = createJsonRecord()
      for (const [key, entry] of Object.entries(value)) {
        if (entry === undefined) {
          continue
        }

        record[key] = serializeJsonValue(entry, joinPath(path, key), state)
      }
      return record
    } finally {
      state.seen.delete(value)
    }
  }

  if (value === undefined) {
    throw new Error(`${formatLocation(state.label, path)} must not be undefined.`)
  }

  throw new Error(`${formatLocation(state.label, path)} must be a JSON value.`)
}

function visitJsonValue(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  ancestors: Set<object>,
  isRoot: boolean
): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      issues.push({
        path,
        message: 'Number values must be finite.'
      })
    }
    return
  }

  if (value === undefined) {
    issues.push({
      path,
      message: isRoot ? 'Value must not be undefined.' : 'Value must be a JSON value.'
    })
    return
  }

  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      issues.push({
        path,
        message: 'Value must not contain circular references.'
      })
      return
    }

    ancestors.add(value)
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index) || value[index] === undefined) {
        issues.push({
          path: `${path}[${index}]`,
          message: 'Value must be a JSON value.'
        })
        continue
      }
      visitJsonValue(value[index], `${path}[${index}]`, issues, ancestors, false)
    }
    ancestors.delete(value)
    return
  }

  if (isPlainRecord(value)) {
    if (ancestors.has(value)) {
      issues.push({
        path,
        message: 'Value must not contain circular references.'
      })
      return
    }

    ancestors.add(value)
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) {
        issues.push({
          path: joinPath(path, key),
          message: 'Value must be a JSON value.'
        })
        continue
      }
      visitJsonValue(entry, joinPath(path, key), issues, ancestors, false)
    }
    ancestors.delete(value)
    return
  }

  issues.push({
    path,
    message: 'Value must be a JSON value.'
  })
}

function createJsonRecord(): Record<string, JsonValue> {
  return Object.create(null) as Record<string, JsonValue>
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function joinPath(path: string, key: string): string {
  const segment = /^[A-Za-z_$][\w$]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`
  return `${path}${segment}`
}

function formatLocation(label: string, path: string): string {
  return path ? `${label}${path}` : label
}
