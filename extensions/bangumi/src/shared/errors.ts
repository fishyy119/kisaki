export type BangumiErrorCode =
  | 'auth_required'
  | 'auth_cancelled'
  | 'auth_expired'
  | 'relay_unavailable'
  | 'bangumi_rate_limited'
  | 'bangumi_validation'
  | 'bangumi_not_found'
  | 'network_failed'
  | 'profile_missing'
  | 'ingest_failed'
  | 'library_update_failed'
  | 'job_cancelled'

export class BangumiExtensionError extends Error {
  constructor(
    public readonly code: BangumiErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'BangumiExtensionError'
  }
}

