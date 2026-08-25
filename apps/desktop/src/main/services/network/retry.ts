import { createLogger } from '@main/log'
import { assertNotAborted, isAbortError, sleep } from '@main/utils/async'

const log = createLogger('Network')

export const DEFAULT_NETWORK_TIMEOUT_MS = 30000
export const DEFAULT_NETWORK_RETRY_COUNT = 3

/**
 * Raised when a request exceeds its time budget. Deliberately not an
 * `AbortError`: retry loops and the extension boundary treat aborts as "the
 * caller asked to stop", while a timeout is a transient fault that may retry.
 */
export class NetworkTimeoutError extends Error {
  readonly name = 'TimeoutError'
  /** Lets boundaries (e.g. extension capabilities) classify this without message matching. */
  readonly code = 'timeout'

  constructor(host: string, timeoutMs: number, options?: ErrorOptions) {
    super(`Network request to ${host} timed out after ${timeoutMs}ms.`, options)
  }
}

export interface NetworkRetryOptions {
  retries: number
  signal?: AbortSignal
  shouldRetry?: (error: Error) => boolean
}

export async function executeWithNetworkRetry<T>(
  fn: () => Promise<T>,
  options: NetworkRetryOptions
): Promise<T> {
  const { retries, signal, shouldRetry } = options
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      assertNotAborted(signal)
      return await fn()
    } catch (error) {
      const currentErrorMessage = error instanceof Error ? error.message : String(error)
      const currentError = error instanceof Error ? error : new Error(String(error))
      lastError = currentError

      if (isAbortError(currentError) || signal?.aborted || shouldRetry?.(currentError) === false) {
        throw currentError
      }

      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
        log.warn('Retrying network request.', {
          attempt: attempt + 1,
          retries,
          delayMs: delay,
          errorMessage: currentErrorMessage
        })
        await sleep(delay, signal)
      }
    }
  }

  throw lastError
}
