import { createLogger } from '@main/log'

const log = createLogger('Network')

export const DEFAULT_NETWORK_TIMEOUT_MS = 30000
export const DEFAULT_NETWORK_RETRY_COUNT = 3

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
          value0: attempt + 1,
          retries: retries,
          delay: delay,
          currentErrorMessage: currentErrorMessage
        })
        await sleep(delay, signal)
      }
    }
  }

  throw lastError
}

export function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError()
  }
}

export function linkAbortSignal(signal: AbortSignal | undefined, onAbort: () => void): () => void {
  if (!signal) {
    return () => undefined
  }

  signal.addEventListener('abort', onAbort, { once: true })
  return () => signal.removeEventListener('abort', onAbort)
}

function isAbortError(error: unknown): error is Error {
  return error instanceof Error && error.name === 'AbortError'
}

function createAbortError(): Error {
  const error = new Error('Request aborted')
  error.name = 'AbortError'
  return error
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    assertNotAborted(signal)

    const timeoutId = setTimeout(() => {
      cleanupAbort()
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timeoutId)
      cleanupAbort()
      reject(createAbortError())
    }
    const cleanupAbort = signal ? linkAbortSignal(signal, onAbort) : () => undefined
  })
}
