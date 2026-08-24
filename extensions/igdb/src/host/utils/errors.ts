import { createCancellationError } from '@kisaki3/extension-sdk'

export type IgdbErrorCode =
  | 'credential_missing'
  | 'credential_invalid'
  | 'credential_required'
  | 'igdb_not_found'
  | 'igdb_rate_limited'
  | 'igdb_rejected'
  | 'network_failed'
  | 'entry_id_invalid'

export class IgdbExtensionError extends Error {
  constructor(
    public readonly code: IgdbErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'IgdbExtensionError'
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
  if (error instanceof IgdbExtensionError) {
    return { code: error.code, message: error.message }
  }

  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }

  return { message: String(error) }
}
