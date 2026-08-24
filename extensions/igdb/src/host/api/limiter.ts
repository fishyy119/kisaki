import { createCancellationError } from '@kisaki3/extension-sdk'
import { throwIfAborted } from '../utils/errors'

/**
 * Sliding-window request gate plus a concurrency cap.
 *
 * IGDB documents both limits — 4 requests per second and at most 8 open
 * requests — and one scrape fans out into dozens of reference reads, so both
 * are enforced here instead of relying on 429 retries.
 */
export class IgdbRateLimiter {
  private readonly requestTimestamps: number[] = []
  private readonly waitingForSlot: Array<() => void> = []
  private inFlight = 0
  private queue = Promise.resolve()

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
    private readonly maxConcurrent: number
  ) {}

  /** Runs `task` once a rate slot and a concurrency slot are both free. */
  async run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    await this.acquireRateSlot(signal)
    await this.acquireConcurrencySlot(signal)

    try {
      return await task()
    } finally {
      this.releaseConcurrencySlot()
    }
  }

  private async acquireRateSlot(signal?: AbortSignal): Promise<void> {
    throwIfAborted(signal)

    const previous = this.queue.catch(() => undefined)
    let release!: () => void
    this.queue = previous.then(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        })
    )

    await previous

    try {
      await this.waitForRateSlot(signal)
    } finally {
      release()
    }
  }

  private async waitForRateSlot(signal?: AbortSignal): Promise<void> {
    for (;;) {
      throwIfAborted(signal)

      const now = Date.now()
      this.prune(now)

      if (this.requestTimestamps.length < this.maxRequests) {
        this.requestTimestamps.push(now)
        return
      }

      await delay(Math.max(1, this.windowMs - (now - this.requestTimestamps[0]!)), signal)
    }
  }

  private acquireConcurrencySlot(signal?: AbortSignal): Promise<void> {
    throwIfAborted(signal)

    if (this.inFlight < this.maxConcurrent) {
      this.inFlight += 1
      return Promise.resolve()
    }

    return new Promise<void>((resolve, reject) => {
      const grant = (): void => {
        signal?.removeEventListener('abort', onAbort)
        this.inFlight += 1
        resolve()
      }

      const onAbort = (): void => {
        const index = this.waitingForSlot.indexOf(grant)
        if (index >= 0) {
          this.waitingForSlot.splice(index, 1)
        }
        reject(createCancellationError('The operation was cancelled.'))
      }

      this.waitingForSlot.push(grant)
      signal?.addEventListener('abort', onAbort, { once: true })
    })
  }

  private releaseConcurrencySlot(): void {
    this.inFlight -= 1
    this.waitingForSlot.shift()?.()
  }

  private prune(now: number): void {
    while (this.requestTimestamps.length > 0 && now - this.requestTimestamps[0]! >= this.windowMs) {
      this.requestTimestamps.shift()
    }
  }
}

export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal)

  return new Promise((resolve, reject) => {
    const timer = setTimeout(cleanupAndResolve, ms)

    function cleanupAndResolve(): void {
      cleanup()
      resolve()
    }

    function onAbort(): void {
      cleanup()
      reject(createCancellationError('The operation was cancelled.'))
    }

    function cleanup(): void {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
