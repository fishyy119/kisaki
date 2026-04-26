import type { RpcValue, SerializableValue } from '@kisaki/extension-api'

/**
 * Converts an unknown value into the SDK JSON-serializable value model.
 */
export function toSerializableValue(
  value: unknown,
  label: string,
  seen = new Set<object>()
): SerializableValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`${label} number values must be finite`)
    }

    return value
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new Error(`${label} must not contain circular references`)
    }

    seen.add(value)
    const items = value.map((entry) => toSerializableValue(entry, label, seen))
    seen.delete(value)
    return items
  }

  if (value && typeof value === 'object') {
    if (seen.has(value)) {
      throw new Error(`${label} must not contain circular references`)
    }

    seen.add(value)
    const result: Record<string, SerializableValue> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = toSerializableValue(entry, label, seen)
    }
    seen.delete(value)
    return result
  }

  throw new Error(`${label} must be JSON-serializable`)
}

/**
 * Converts an unknown value into a serializable object record.
 */
export function toSerializableRecord(
  value: unknown,
  label: string
): Record<string, SerializableValue> {
  const normalized = toSerializableValue(value, label)
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
