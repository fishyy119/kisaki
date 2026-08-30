import type { OAuthRelayFailure } from '../auth/oauth-relay'
import { m } from '../i18n'

export type AnilistErrorCode =
  | 'auth_required'
  | 'auth_expired'
  | 'auth_cancelled'
  | 'relay_unavailable'
  | 'anilist_not_found'
  | 'anilist_rate_limited'
  | 'anilist_rejected'
  | 'network_failed'
  | 'entry_id_invalid'
  | 'operation_running'

export class AnilistExtensionError extends Error {
  constructor(
    public readonly code: AnilistErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'AnilistExtensionError'
  }
}

/** Maps relay OAuth failures onto AniList error codes and localized copy. */
export function createRelayError(failure: OAuthRelayFailure): AnilistExtensionError {
  switch (failure) {
    case 'relay_unavailable':
      return new AnilistExtensionError('relay_unavailable', m().errors.relayUnavailable)
    case 'session_expired':
      return new AnilistExtensionError('auth_expired', m().errors.loginSessionExpired)
    case 'callback_invalid':
      return new AnilistExtensionError('auth_cancelled', m().errors.loginCallbackInvalid)
    case 'no_pending_login':
      return new AnilistExtensionError('auth_cancelled', m().errors.noPendingLogin)
  }
}

export function toSafeErrorLog(error: unknown): Record<string, unknown> {
  if (error instanceof AnilistExtensionError) {
    return { code: error.code, message: error.message }
  }

  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }

  return { message: String(error) }
}
