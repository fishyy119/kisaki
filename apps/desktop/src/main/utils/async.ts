/**
 * Cancellation and concurrency primitives shared by main-process runtime code.
 *
 * Cancellation is expressed as a DOM-style `AbortError` so it survives the trip
 * through `fetch`, streams, and any other web-platform API in the path, and so
 * every layer recognizes it with the same check.
 */

export function createAbortError(): Error {
  const error = new Error('Operation aborted')
  error.name = 'AbortError'
  return error
}

export function isAbortError(error: unknown): error is Error {
  return error instanceof Error && error.name === 'AbortError'
}

export function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError()
  }
}

/** Subscribes to abort and returns the unsubscribe, safe to call when unsignalled. */
export function linkAbortSignal(signal: AbortSignal | undefined, onAbort: () => void): () => void {
  if (!signal) {
    return () => undefined
  }

  signal.addEventListener('abort', onAbort, { once: true })
  return () => signal.removeEventListener('abort', onAbort)
}

/** Sleep that rejects with an AbortError instead of outliving a cancellation. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    assertNotAborted(signal)

    const timeoutId = setTimeout(() => {
      cleanupAbort()
      resolve()
    }, ms)
    const cleanupAbort = linkAbortSignal(signal, () => {
      clearTimeout(timeoutId)
      cleanupAbort()
      reject(createAbortError())
    })
  })
}

/**
 * Abort-aware counting semaphore.
 *
 * Waiters are served first-in-first-out. A waiter that aborts leaves the queue
 * without taking a permit, so a cancelled operation never holds capacity that a
 * live one could use.
 */
export class Semaphore {
  private available: number
  private readonly waiters: Array<() => void> = []

  constructor(permits: number) {
    if (!Number.isInteger(permits) || permits < 1) {
      throw new Error('Semaphore permits must be a positive integer.')
    }

    this.available = permits
  }

  async acquire(signal?: AbortSignal): Promise<void> {
    assertNotAborted(signal)

    if (this.available > 0) {
      this.available -= 1
      return
    }

    await new Promise<void>((resolve, reject) => {
      const grant = (): void => {
        cleanupAbort()
        resolve()
      }
      const cleanupAbort = linkAbortSignal(signal, () => {
        this.removeWaiter(grant)
        cleanupAbort()
        reject(createAbortError())
      })

      this.waiters.push(grant)
    })
  }

  release(): void {
    const next = this.waiters.shift()
    if (next) {
      next()
      return
    }

    this.available += 1
  }

  async run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    await this.acquire(signal)
    try {
      return await task()
    } finally {
      this.release()
    }
  }

  private removeWaiter(waiter: () => void): void {
    const index = this.waiters.indexOf(waiter)
    if (index >= 0) {
      this.waiters.splice(index, 1)
    }
  }
}
