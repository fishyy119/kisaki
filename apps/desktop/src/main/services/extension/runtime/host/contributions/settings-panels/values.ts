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

export function parentsEqual(
  left: SettingsPanelParentRef | undefined,
  right: SettingsPanelParentRef
): boolean {
  if (!left || left.surface !== right.surface) {
    return false
  }
  return left.surface === 'root' || left.dialogId === (right as { dialogId: string }).dialogId
}
