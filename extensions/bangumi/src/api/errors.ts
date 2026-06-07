import { BangumiExtensionError, type BangumiErrorCode } from '../shared/errors'
import { omitUndefined } from '../shared/object'

export interface BangumiApiErrorOptions {
  status?: number
  path?: string
  retryAfterMs?: number
}

export class BangumiApiError extends BangumiExtensionError {
  readonly status?: number
  readonly path?: string
  readonly retryAfterMs?: number

  constructor(code: BangumiErrorCode, message: string, options: BangumiApiErrorOptions = {}) {
    super(code, message)
    this.name = 'BangumiApiError'
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

export function normalizeBangumiApiError(
  status: number,
  path: string,
  data: unknown,
  retryAfterMs?: number
): BangumiApiError {
  const detail = readErrorMessage(data)

  if (status === 401 || status === 403) {
    return new BangumiApiError('auth_required', detail || 'Bangumi 登录已失效，请重新登录。', {
      status,
      path
    })
  }

  if (status === 404) {
    return new BangumiApiError('bangumi_not_found', detail || 'Bangumi 条目不存在。', {
      status,
      path
    })
  }

  if (status === 429) {
    return new BangumiApiError(
      'bangumi_rate_limited',
      detail || 'Bangumi API 请求过于频繁，请稍后重试。',
      omitUndefined({ status, path, retryAfterMs })
    )
  }

  if (status >= 400 && status < 500) {
    return new BangumiApiError('bangumi_validation', detail || 'Bangumi API 拒绝了本次请求。', {
      status,
      path
    })
  }

  return new BangumiApiError('network_failed', detail || 'Bangumi API 暂时不可用。', {
    status,
    path
  })
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

function readErrorMessage(data: unknown): string | undefined {
  if (typeof data === 'string') {
    return data.trim() || undefined
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return undefined
  }

  const record = data as Record<string, unknown>
  for (const key of ['description', 'message', 'error_description', 'error']) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return undefined
}
