import { readErrorCode, type ExtensionTaskRunFailureErrorPayload } from '@kisaki3/extension-api'

export function toTaskRunFailureErrorPayload(error: unknown): ExtensionTaskRunFailureErrorPayload {
  if (error instanceof Error) {
    const message = error.message.trim()
    const code = readErrorCode(error)
    return {
      message: message || 'Extension task run failed.',
      ...(code ? { code } : {})
    }
  }

  if (typeof error === 'string' && error.trim()) {
    return {
      message: error.trim()
    }
  }

  return {
    message: 'Extension task run failed.'
  }
}
