import { m } from '../i18n'
import { IgdbExtensionError, type IgdbErrorCode } from '../utils/errors'

export interface IgdbApiErrorOptions {
  status?: number
  path?: string
}

export class IgdbApiError extends IgdbExtensionError {
  readonly status?: number
  readonly path?: string

  constructor(code: IgdbErrorCode, message: string, options: IgdbApiErrorOptions = {}) {
    super(code, message)
    this.name = 'IgdbApiError'
    if (options.status !== undefined) {
      this.status = options.status
    }
    if (options.path !== undefined) {
      this.path = options.path
    }
  }
}

/**
 * Classifies a failed IGDB or Twitch response into a typed reason.
 *
 * The response body is remote content, so it is never surfaced: the boundary
 * message is ours and stays localized.
 */
export function normalizeIgdbApiError(status: number, path: string): IgdbApiError {
  if (status === 401 || status === 403) {
    return new IgdbApiError('credential_invalid', m().errors.credentialInvalid, { status, path })
  }

  if (status === 404) {
    return new IgdbApiError('igdb_not_found', m().errors.notFound, { status, path })
  }

  if (status === 429) {
    return new IgdbApiError('igdb_rate_limited', m().errors.rateLimited, { status, path })
  }

  if (status >= 400 && status < 500) {
    return new IgdbApiError('igdb_rejected', m().errors.rejected, { status, path })
  }

  return new IgdbApiError('network_failed', m().errors.unavailable, { status, path })
}
