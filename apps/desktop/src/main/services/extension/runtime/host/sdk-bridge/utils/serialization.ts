import { toJsonObject, toJsonValue, type RpcValue } from '@kisaki3/extension-api'

export { toJsonObject, toJsonValue }

export function toOptionalJsonRecord<TRecord extends object>(
  value: TRecord | undefined,
  label: string
): TRecord | undefined {
  return value === undefined ? undefined : toJsonRecord(value, label)
}

export function toJsonRecord<TRecord extends object>(value: TRecord, label: string): TRecord {
  return toJsonObject(value, label) as unknown as TRecord
}

export function toOptionalJsonField<TValue>(value: unknown, label: string): TValue | undefined {
  return value === undefined ? undefined : (toJsonValue(value, label) as TValue)
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
    return toJsonValue(value, 'log argument')
  } catch {
    return String(value)
  }
}
