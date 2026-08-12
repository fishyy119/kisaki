import { createCancellationError } from '@kisaki3/extension-sdk'

export type BangumiErrorCode =
  | 'auth_required'
  | 'auth_cancelled'
  | 'auth_expired'
  | 'relay_unavailable'
  | 'bangumi_rate_limited'
  | 'bangumi_validation'
  | 'bangumi_not_found'
  | 'network_failed'
  | 'local_media_unsupported'
  | 'profile_missing'
  | 'ingest_failed'
  | 'library_update_failed'
  | 'bangumi_job_running'

export class BangumiExtensionError extends Error {
  constructor(
    public readonly code: BangumiErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'BangumiExtensionError'
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
