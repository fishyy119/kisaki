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
 * Cancellation reaches extension code either as our own job error or as the
 * DOM-style `AbortError` raised by aborted host capability calls.
 */
export function isCancellationError(error: unknown): boolean {
  return (
    (error instanceof BangumiExtensionError && error.code === 'job_cancelled') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}
