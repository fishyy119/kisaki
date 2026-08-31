import type { OAuthRelayFailure } from '../auth/oauth-relay'
import { m } from '../i18n'

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

/** Maps relay OAuth failures onto Bangumi error codes and localized copy. */
export function createRelayError(failure: OAuthRelayFailure): BangumiExtensionError {
  switch (failure) {
    case 'relay_unavailable':
      return new BangumiExtensionError('relay_unavailable', m().errors.relayUnavailable)
    case 'session_expired':
      return new BangumiExtensionError('auth_expired', m().errors.loginSessionExpired)
    case 'callback_invalid':
      return new BangumiExtensionError('auth_cancelled', m().errors.loginCallbackInvalid)
    case 'authorize_denied':
      return new BangumiExtensionError('auth_cancelled', m().errors.loginDenied)
    case 'authorize_failed':
      return new BangumiExtensionError('auth_cancelled', m().errors.loginAuthorizeFailed)
    case 'no_pending_login':
      return new BangumiExtensionError('auth_cancelled', m().errors.noPendingLogin)
  }
}
