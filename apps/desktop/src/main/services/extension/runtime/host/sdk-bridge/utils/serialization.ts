import type { RpcValue, SerializableValue } from '@kisaki/extension-api'

export interface SerializationOptions {
  undefinedObjectProperties?: 'error' | 'omit'
  undefinedArrayItems?: 'error' | 'null'
}

export const JSON_COMPATIBLE_UNDEFINED_SERIALIZATION = {
  undefinedObjectProperties: 'omit',
  undefinedArrayItems: 'null'
} as const satisfies SerializationOptions

interface SerializationState {
  readonly label: string
  readonly options: Required<SerializationOptions>
  readonly seen: Set<object>
}

/**
 * Converts an unknown value into the SDK JSON-serializable value model.
 */
export function toSerializableValue(
  value: unknown,
  label: string,
  options: SerializationOptions = {}
): SerializableValue {
  return serializeValue(value, '', {
    label,
    options: normalizeSerializationOptions(options),
    seen: new Set<object>()
  })
}

function serializeValue(
  value: unknown,
  path: string,
  state: SerializationState
): SerializableValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`${formatLocation(state.label, path)} number values must be finite`)
    }

    return value
  }

  if (Array.isArray(value)) {
    if (state.seen.has(value)) {
      throw new Error(`${formatLocation(state.label, path)} must not contain circular references`)
    }

    state.seen.add(value)
    try {
      const items: SerializableValue[] = []
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index) || value[index] === undefined) {
          if (state.options.undefinedArrayItems === 'null') {
            items.push(null)
            continue
          }

          throw new Error(
            `${formatLocation(state.label, `${path}[${index}]`)} must be JSON-serializable`
          )
        }

        items.push(serializeValue(value[index], `${path}[${index}]`, state))
      }
      return items
    } finally {
      state.seen.delete(value)
    }
  }

  if (value && typeof value === 'object') {
    if (!isPlainRecord(value)) {
      throw new Error(`${formatLocation(state.label, path)} must be JSON-serializable`)
    }

    if (state.seen.has(value)) {
      throw new Error(`${formatLocation(state.label, path)} must not contain circular references`)
    }

    state.seen.add(value)
    try {
      const result: Record<string, SerializableValue> = {}
      for (const [key, entry] of Object.entries(value)) {
        const childPath = joinPath(path, key)
        if (entry === undefined) {
          if (state.options.undefinedObjectProperties === 'omit') {
            continue
          }

          throw new Error(`${formatLocation(state.label, childPath)} must be JSON-serializable`)
        }

        result[key] = serializeValue(entry, childPath, state)
      }
      return result
    } finally {
      state.seen.delete(value)
    }
  }

  throw new Error(`${formatLocation(state.label, path)} must be JSON-serializable`)
}

/**
 * Converts an unknown value into a serializable object record.
 */
export function toSerializableRecord(
  value: unknown,
  label: string,
  options: SerializationOptions = {}
): Record<string, SerializableValue> {
  const normalized = toSerializableValue(value, label, options)
  if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) {
    throw new Error(`${label} must be an object`)
  }

  return normalized as Record<string, SerializableValue>
}

/**
 * Converts log arguments into RPC-safe payload values.
 */
export function toRpcValue(value: unknown): RpcValue {
  if (value instanceof Uint8Array) {
    return value
  }

  if (value instanceof Error) {
    const serializedError: Record<string, string> = {
      name: value.name,
      message: value.message
    }

    if (value.stack) {
      serializedError.stack = value.stack
    }

    return serializedError
  }

  try {
    return toSerializableValue(value, 'log argument')
  } catch {
    return String(value)
  }
}

function normalizeSerializationOptions(
  options: SerializationOptions
): Required<SerializationOptions> {
  return {
    undefinedObjectProperties: options.undefinedObjectProperties ?? 'error',
    undefinedArrayItems: options.undefinedArrayItems ?? 'error'
  }
}

function isPlainRecord(value: object): value is Record<string, unknown> {
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
