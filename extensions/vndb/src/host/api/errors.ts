import { m } from '../i18n'
import { VndbExtensionError, type VndbErrorCode } from '../utils/errors'

export interface VndbApiErrorOptions {
  status?: number
  path?: string
}

export class VndbApiError extends VndbExtensionError {
  readonly status?: number
  readonly path?: string

  constructor(code: VndbErrorCode, message: string, options: VndbApiErrorOptions = {}) {
    super(code, message)
    this.name = 'VndbApiError'
    if (options.status !== undefined) {
      this.status = options.status
    }
    if (options.path !== undefined) {
      this.path = options.path
    }
  }
}

/**
 * Classifies a failed VNDB response into a typed reason.
 *
 * VNDB returns plain-text error bodies, which are remote content, so they are
 * never surfaced: the boundary message is ours and stays localized.
 */
export function normalizeVndbApiError(status: number, path: string): VndbApiError {
  if (status === 401 || status === 403) {
    return new VndbApiError('token_invalid', m().errors.tokenInvalid, { status, path })
  }

  if (status === 404) {
    return new VndbApiError('vndb_not_found', m().errors.notFound, { status, path })
  }

  if (status === 429) {
    return new VndbApiError('vndb_rate_limited', m().errors.rateLimited, { status, path })
  }

  if (status >= 400 && status < 500) {
    return new VndbApiError('vndb_rejected', m().errors.rejected, { status, path })
  }

  return new VndbApiError('network_failed', m().errors.unavailable, { status, path })
}
