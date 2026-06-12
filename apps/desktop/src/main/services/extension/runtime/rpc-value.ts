import type { RpcValue } from '@kisaki3/extension-api'

interface RpcSerializationState {
  readonly label: string
  readonly seen: Set<object>
}

/**
 * Normalizes an untrusted value into the RPC wire value domain (strict JSON
 * plus binary), the runtime companion of the compile-time `WireSafe` check.
 * @remarks Mirrors `toJsonValue` semantics — deep-copies onto null-prototype
 * records, drops `undefined` object properties, converts array holes and
 * `undefined` entries to `null`, and rejects non-finite numbers, circular
 * references, and non-plain values (Date, Map, Set, class instances,
 * functions; `toJSON` is not honored) — with one addition: `Uint8Array`
 * leaves pass through by reference, since the structured-clone transport
 * copies them at send time.
 * @param label - Prefix used in error messages to locate the offending path.
 * @throws Error when the value cannot be represented on the wire.
 */
export function toRpcValue(value: unknown, label = 'value'): RpcValue {
  return serializeRpcValue(value, '', {
    label,
    seen: new Set<object>()
  })
}

function serializeRpcValue(value: unknown, path: string, state: RpcSerializationState): RpcValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`${formatLocation(state.label, path)} number values must be finite.`)
    }

    return value
  }

  if (value instanceof Uint8Array) {
    return value
  }

  if (Array.isArray(value)) {
    if (state.seen.has(value)) {
      throw new Error(`${formatLocation(state.label, path)} must not contain circular references.`)
    }

    state.seen.add(value)
    try {
      const items: RpcValue[] = []
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index) || value[index] === undefined) {
          items.push(null)
          continue
        }

        items.push(serializeRpcValue(value[index], `${path}[${index}]`, state))
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
      const record = Object.create(null) as Record<string, RpcValue>
      for (const [key, entry] of Object.entries(value)) {
        if (entry === undefined) {
          continue
        }

        record[key] = serializeRpcValue(entry, joinPath(path, key), state)
      }
      return record
    } finally {
      state.seen.delete(value)
    }
  }

  if (value === undefined) {
    throw new Error(`${formatLocation(state.label, path)} must not be undefined.`)
  }

  throw new Error(`${formatLocation(state.label, path)} must be a JSON value or binary.`)
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
