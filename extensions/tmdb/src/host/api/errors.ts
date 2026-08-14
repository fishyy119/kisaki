import { TmdbExtensionError, type TmdbErrorCode } from '../utils/errors'
import { omitUndefined } from '../utils/object'
import { m } from '../i18n'

export interface TmdbApiErrorOptions {
  status?: number
  path?: string
  retryAfterMs?: number
}

export class TmdbApiError extends TmdbExtensionError {
  readonly status?: number
  readonly path?: string
  readonly retryAfterMs?: number

  constructor(code: TmdbErrorCode, message: string, options: TmdbApiErrorOptions = {}) {
    super(code, message)
    this.name = 'TmdbApiError'
    if (options.status !== undefined) {
      this.status = options.status
    }
    if (options.path !== undefined) {
      this.path = options.path
    }
    if (options.retryAfterMs !== undefined) {
      this.retryAfterMs = options.retryAfterMs
    }
  }
}

/**
 * Classifies a failed TMDB response into a typed reason.
 *
 * TMDB's own `status_message` is remote text, so it is never surfaced: the
 * boundary message is ours and stays localized.
 */
export function normalizeTmdbApiError(
  status: number,
  path: string,
  retryAfterMs?: number
): TmdbApiError {
  if (status === 401 || status === 403) {
    return new TmdbApiError('api_key_invalid', m().errors.apiKeyInvalid, { status, path })
  }

  if (status === 404) {
    return new TmdbApiError('tmdb_not_found', m().errors.notFound, { status, path })
  }

  if (status === 429) {
    return new TmdbApiError(
      'tmdb_rate_limited',
      m().errors.rateLimited,
      omitUndefined({ status, path, retryAfterMs })
    )
  }

  if (status >= 400 && status < 500) {
    return new TmdbApiError('tmdb_rejected', m().errors.rejected, { status, path })
  }

  return new TmdbApiError('network_failed', m().errors.unavailable, { status, path })
}

export function readRetryAfterMs(headers: Record<string, string>): number | undefined {
  const value = readHeader(headers, 'retry-after')
  if (!value) {
    return undefined
  }

  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.trunc(seconds * 1000)
  }

  const dateMs = Date.parse(value)
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now())
  }

  return undefined
}

function readHeader(headers: Record<string, string>, key: string): string | undefined {
  const lowerKey = key.toLowerCase()
  for (const [headerKey, value] of Object.entries(headers)) {
    if (headerKey.toLowerCase() === lowerKey) {
      return value
    }
  }
  return undefined
}
