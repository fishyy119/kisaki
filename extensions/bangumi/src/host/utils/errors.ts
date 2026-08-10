import { isCancellationError as isHostCancellation } from '@kisaki3/extension-sdk'

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
  | 'job_cancelled'
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
 * Cancellation reaches extension code either as our own job error or in one of
 * the shapes the host uses: a cancelled capability call or a DOM-style
 * `AbortError` from an aborted local operation.
 */
export function isCancellationError(error: unknown): boolean {
  return (
    (error instanceof BangumiExtensionError && error.code === 'job_cancelled') ||
    isHostCancellation(error)
  )
}

export function createAbortError(): Error {
  const error = new Error('Operation was cancelled.')
  error.name = 'AbortError'
  return error
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError()
  }
}
