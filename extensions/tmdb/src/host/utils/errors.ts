import { createCancellationError } from '@kisaki3/extension-sdk'

export type TmdbErrorCode =
  | 'api_key_missing'
  | 'api_key_invalid'
  | 'tmdb_not_found'
  | 'tmdb_rate_limited'
  | 'tmdb_rejected'
  | 'network_failed'
  | 'subject_id_invalid'

export class TmdbExtensionError extends Error {
  constructor(
    public readonly code: TmdbErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'TmdbExtensionError'
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
  if (error instanceof TmdbExtensionError) {
    return { code: error.code, message: error.message }
  }

  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }

  return { message: String(error) }
}
