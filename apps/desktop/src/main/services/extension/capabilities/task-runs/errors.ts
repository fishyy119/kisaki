import { createCancellationError, type TaskRunFailureErrorPayload } from '@kisaki3/extension-api'

export function createTaskRunCancelledError() {
  return createCancellationError('Task run was cancelled.')
}

export function toFailureError(payload: TaskRunFailureErrorPayload): Error {
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
