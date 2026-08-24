import { createCancellationError } from '@kisaki3/extension-sdk'
import { throwIfAborted } from '../utils/errors'

/**
 * Sliding-window request gate.
 *
 * The YMGal developer notes ask clients to avoid concurrent bursts rather than
 * publishing a quota, and one game scrape fans out into per-character and
 * per-person archive reads, so requests are paced here instead of relying on
 * retries alone.
 */
export class YmgalRateLimiter {
  private readonly requestTimestamps: number[] = []
  private queue = Promise.resolve()

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  async acquire(signal?: AbortSignal): Promise<void> {
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
      await this.waitForSlot(signal)
    } finally {
      release()
    }
  }

  private async waitForSlot(signal?: AbortSignal): Promise<void> {
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
