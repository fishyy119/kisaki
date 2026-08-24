import { createCancellationError } from '@kisaki3/extension-sdk'

export type YmgalErrorCode =
  | 'auth_failed'
  | 'credential_required'
  | 'ymgal_not_found'
  | 'ymgal_rate_limited'
  | 'ymgal_rejected'
  | 'network_failed'
  | 'archive_id_invalid'

export class YmgalExtensionError extends Error {
  constructor(
    public readonly code: YmgalErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'YmgalExtensionError'
  }
}

/**
 * Cancellations must carry the host's shared `cancelled` code: these errors
 * cross the RPC boundary, and the host only recognizes coded cancellations
 * when deciding to abandon (rather than fail) the surrounding operation.
 */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createCancellationError('The operation was cancelled.')
  }
}

export function toSafeErrorLog(error: unknown): Record<string, unknown> {
  if (error instanceof YmgalExtensionError) {
    return { code: error.code, message: error.message }
  }

  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }

  return { message: String(error) }
}
