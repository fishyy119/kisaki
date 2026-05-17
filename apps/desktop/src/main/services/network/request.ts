import { net } from 'electron'
import type { FetchOptions } from '@shared/network'
import type { NetworkRateLimitGate } from './rate-limits'
import {
  assertNotAborted,
  DEFAULT_NETWORK_RETRY_COUNT,
  DEFAULT_NETWORK_TIMEOUT_MS,
  executeWithNetworkRetry,
  linkAbortSignal
} from './shared'

export interface NetworkRequestClientOptions {
  rateLimits: NetworkRateLimitGate
}

export class NetworkRequestClient {
  constructor(private readonly options: NetworkRequestClientOptions) {}

  /**
   * Unified fetch with timeout, retry, and rate limiting.
   * Uses Electron's net.fetch which respects session proxy settings.
   */
  async fetch(url: string, options: FetchOptions = {}): Promise<Response> {
    const {
      timeout = DEFAULT_NETWORK_TIMEOUT_MS,
      retries = DEFAULT_NETWORK_RETRY_COUNT,
      rateLimitKey,
      method = 'GET',
      headers,
      body,
      signal
    } = options

    if (rateLimitKey) {
      await this.options.rateLimits.waitForSlot(rateLimitKey)
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
      body: body as BodyInit
    }

    return executeWithNetworkRetry(
      () => this.fetchWithTimeout(url, fetchOptions, timeout, signal),
      { retries, signal }
    )
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number,
    signal?: AbortSignal
  ): Promise<Response> {
    const controller = new AbortController()
    const cleanupAbort = linkAbortSignal(signal, () => controller.abort())
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      assertNotAborted(signal)
      return await net.fetch(url, {
        ...options,
        signal: controller.signal
      })
    } finally {
      clearTimeout(timeoutId)
      cleanupAbort()
    }
  }
}
