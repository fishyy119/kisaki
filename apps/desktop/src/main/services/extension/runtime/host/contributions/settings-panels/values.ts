import type {
  SerializableRecord,
  SerializableValue,
  SettingsPanelCallbackResult,
  SettingsPanelParentRef
} from '@kisaki/extension-api'
export function createSettingsPanelError(
  message: string,
  code?: string,
  details?: SerializableRecord
): SettingsPanelCallbackResult {
  return {
    success: false,
    error: {
      code,
      message,
      details
    }
  }
}

export function validateCommitValue(
  kind: string | undefined,
  value: SerializableValue | undefined
): string | null {
  switch (kind) {
    case 'switch':
    case 'checkbox':
      return typeof value === 'boolean' ? null : `${kind} callback requires a boolean value.`
    case 'select':
    case 'radioGroup':
    case 'textInput':
    case 'textarea':
      return typeof value === 'string' ? null : `${kind} callback requires a string value.`
    case 'numberInput':
      return typeof value === 'number' && Number.isFinite(value)
        ? null
        : 'numberInput callback requires a finite number value.'
    case 'multiSelect':
    case 'stringList':
      return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
        ? null
        : `${kind} callback requires a string array value.`
    case 'recordList':
      return Array.isArray(value) && value.every(isSerializableRecordLike)
        ? null
        : 'recordList callback requires an array of serializable records.'
    default:
      return null
  }
}

function isSerializableRecordLike(value: SerializableValue): boolean {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function toParams(value: SerializableRecord | undefined): SerializableRecord {
  return value ?? {}
}

export function compactRecord(record: Record<string, unknown>): Record<string, unknown> {
  const compacted: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) {
      continue
    }
    compacted[key] = value
  }
  return compacted
}

export function normalizeSettingsPanelExtensionValue<T>(value: T, label: string): T {
  return normalizeSettingsPanelValue(value, label, '', new Set<object>()) as T
}

function normalizeSettingsPanelValue(
  value: unknown,
  label: string,
  path: string,
  seen: Set<object>
): unknown {
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new Error(`${formatLocation(label, path)} must not contain circular references.`)
    }

    seen.add(value)
    try {
      const items: unknown[] = []
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index) || value[index] === undefined) {
          items.push(null)
          continue
        }

        items.push(normalizeSettingsPanelValue(value[index], label, `${path}[${index}]`, seen))
      }
      return items
    } finally {
      seen.delete(value)
    }
  }

  if (isPlainRecord(value)) {
    if (seen.has(value)) {
      throw new Error(`${formatLocation(label, path)} must not contain circular references.`)
    }

    seen.add(value)
    try {
      const record: Record<string, unknown> = {}
      for (const [key, entry] of Object.entries(value)) {
        if (entry === undefined) {
          continue
        }

        record[key] = normalizeSettingsPanelValue(entry, label, joinPath(path, key), seen)
      }
      return record
    } finally {
      seen.delete(value)
    }
  }

  return value
}

export function parentsEqual(
  left: SettingsPanelParentRef | undefined,
  right: SettingsPanelParentRef
): boolean {
  if (!left || left.surface !== right.surface) {
    return false
  }
  return left.surface === 'root' || left.dialogId === (right as { dialogId: string }).dialogId
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
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
