import { m } from '../i18n'
import { YmgalExtensionError, type YmgalErrorCode } from '../utils/errors'

export interface YmgalApiErrorOptions {
  status?: number
  /** YMGal business code from the response envelope, when one was parsed. */
  apiCode?: number
  path?: string
}

export class YmgalApiError extends YmgalExtensionError {
  readonly status?: number
  readonly apiCode?: number
  readonly path?: string

  constructor(code: YmgalErrorCode, message: string, options: YmgalApiErrorOptions = {}) {
    super(code, message)
    this.name = 'YmgalApiError'
    if (options.status !== undefined) {
      this.status = options.status
    }
    if (options.apiCode !== undefined) {
      this.apiCode = options.apiCode
    }
    if (options.path !== undefined) {
      this.path = options.path
    }
  }
}

/** Business codes YMGal uses for "the archive you asked for does not exist". */
const NOT_FOUND_API_CODES = new Set([404, 614])

/** A missing archive is an answer, not a failure; callers skip such entities. */
export function isYmgalNotFound(error: unknown): boolean {
  return error instanceof YmgalExtensionError && error.code === 'ymgal_not_found'
}

/**
 * Classifies a failed YMGal response into a typed reason.
 *
 * YMGal's own `msg` is remote text, so it is never surfaced: the boundary
 * message is ours and stays localized.
 */
export function normalizeYmgalHttpError(status: number, path: string): YmgalApiError {
  if (status === 401 || status === 403) {
    return new YmgalApiError('auth_failed', m().errors.authFailed, { status, path })
  }

  if (status === 404) {
    return new YmgalApiError('ymgal_not_found', m().errors.notFound, { status, path })
  }

  if (status === 429) {
    return new YmgalApiError('ymgal_rate_limited', m().errors.rateLimited, { status, path })
  }

  if (status >= 400 && status < 500) {
    return new YmgalApiError('ymgal_rejected', m().errors.rejected, { status, path })
  }

  return new YmgalApiError('network_failed', m().errors.unavailable, { status, path })
}

/** Classifies a 2xx response whose envelope reports a business failure. */
export function normalizeYmgalEnvelopeError(apiCode: number, path: string): YmgalApiError {
  if (NOT_FOUND_API_CODES.has(apiCode)) {
    return new YmgalApiError('ymgal_not_found', m().errors.notFound, { apiCode, path })
  }

  if (apiCode === 401 || apiCode === 403) {
    return new YmgalApiError('auth_failed', m().errors.authFailed, { apiCode, path })
  }

  if (apiCode === 429) {
    return new YmgalApiError('ymgal_rate_limited', m().errors.rateLimited, { apiCode, path })
  }

  return new YmgalApiError('ymgal_rejected', m().errors.rejected, { apiCode, path })
}
