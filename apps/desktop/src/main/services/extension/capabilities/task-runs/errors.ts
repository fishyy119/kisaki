import {
  createExtensionError,
  type ExtensionTaskRunFailureErrorPayload
} from '@kisaki3/extension-api'

const TASK_RUN_CANCELLED_ERROR_CODE = 'task_run_cancelled'

export function createTaskRunCancelledError() {
  return createExtensionError('Task run was cancelled.', {
    code: TASK_RUN_CANCELLED_ERROR_CODE
  })
}

export function toFailureError(payload: ExtensionTaskRunFailureErrorPayload): Error {
  const message =
    isPlainObject(payload) && typeof payload.message === 'string' && payload.message.trim()
      ? payload.message.trim()
      : 'Extension task run failed.'
  const error = new Error(message)
  if (isPlainObject(payload) && typeof payload.code === 'string' && payload.code.trim()) {
    ;(error as Error & { code?: string }).code = payload.code.trim()
  }
  return error
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
