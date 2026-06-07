import {
  toJsonValue,
  type JsonObject,
  type JsonValue,
  type SettingsPanelCallbackResult,
  type SettingsPanelParentRef
} from '@kisaki3/extension-api'
export function createSettingsPanelError(
  message: string,
  code?: string,
  details?: JsonObject
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

export function validateChangeValue(
  kind: string | undefined,
  value: JsonValue | undefined
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
      return Array.isArray(value) && value.every(isJsonObjectLike)
        ? null
        : 'recordList callback requires an array of JSON objects.'
    default:
      return null
  }
}

function isJsonObjectLike(value: JsonValue): boolean {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function toParams(value: JsonObject | undefined): JsonObject {
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
  return toJsonValue(value, label) as T
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
