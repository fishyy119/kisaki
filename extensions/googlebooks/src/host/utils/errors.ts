import type { OAuthRelayFailure } from '@kisaki3/extension-sdk'
import { m } from '../i18n'

export type GbooksErrorCode =
  | 'auth_required'
  | 'auth_expired'
  | 'auth_cancelled'
  | 'relay_unavailable'
  | 'gbooks_not_found'
  | 'gbooks_rate_limited'
  | 'gbooks_rejected'
  | 'network_failed'
  | 'entry_id_invalid'
  | 'operation_running'

export class GbooksExtensionError extends Error {
  constructor(
    public readonly code: GbooksErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'GbooksExtensionError'
  }
}

/** Maps relay OAuth failures onto Google Books error codes and localized copy. */
export function createRelayError(failure: OAuthRelayFailure): GbooksExtensionError {
  switch (failure) {
    case 'relay_unavailable':
      return new GbooksExtensionError('relay_unavailable', m().errors.relayUnavailable)
    case 'session_expired':
      return new GbooksExtensionError('auth_expired', m().errors.loginSessionExpired)
    case 'callback_invalid':
      return new GbooksExtensionError('auth_cancelled', m().errors.loginCallbackInvalid)
    case 'no_pending_login':
      return new GbooksExtensionError('auth_cancelled', m().errors.noPendingLogin)
  }
}

export function toSafeErrorLog(error: unknown): Record<string, unknown> {
  if (error instanceof GbooksExtensionError) {
    return { code: error.code, message: error.message }
  }

  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }

  return { message: String(error) }
}
