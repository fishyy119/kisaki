import { createCancellationError } from '@kisaki3/extension-api'

/**
 * Cancellation-aware timing primitives shared by extension API clients.
 *
 * Cancellations must carry the host's shared `cancelled` code: these errors
 * cross the RPC boundary, and the host only recognizes coded cancellations
 * when deciding to abandon (rather than fail) the surrounding operation.
 */

/** Throws the coded cancellation error when the signal has already aborted. */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createCancellationError('The operation was cancelled.')
  }
}

/** Waits `ms`, rejecting with the coded cancellation error on abort. */
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

export interface RateLimitConfig {
  /** Requests admitted per sliding window. */
  maxRequests: number
  windowMs: number
  /** Cap on simultaneously running tasks; omit for unbounded concurrency. */
  maxConcurrent?: number
}

/**
 * Sliding-window request gate with an optional concurrency cap.
 *
 * One scrape fans out into many upstream reads, so extensions pace requests
 * here instead of relying on 429 retries alone. The config may be a live
 * reader so settings changes take effect on the next request rather than at
 * the next app start; values are clamped defensively because readers hand
 * over user-editable data.
 */
export class RateLimiter {
  private readonly requestTimestamps: number[] = []
  private readonly waitingForSlot: Array<() => void> = []
  private inFlight = 0
  private queue = Promise.resolve()

  constructor(private readonly config: RateLimitConfig | (() => Promise<RateLimitConfig>)) {}

  /** Waits for a rate slot; callers issue the request themselves afterwards. */
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
      await this.waitForRateSlot(signal)
    } finally {
      release()
    }
  }

  /** Runs `task` once a rate slot and, when capped, a concurrency slot are free. */
  async run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    await this.acquire(signal)

    const { maxConcurrent } = await this.readConfig()
    if (maxConcurrent === undefined) {
      return task()
    }

    await this.acquireConcurrencySlot(maxConcurrent, signal)
    try {
      return await task()
    } finally {
      this.releaseConcurrencySlot()
    }
  }

  private async waitForRateSlot(signal?: AbortSignal): Promise<void> {
    for (;;) {
      throwIfAborted(signal)

      const { maxRequests, windowMs } = await this.readConfig()
      const now = Date.now()
      this.prune(now, windowMs)

      if (this.requestTimestamps.length < maxRequests) {
        this.requestTimestamps.push(now)
        return
      }

      await delay(Math.max(1, windowMs - (now - this.requestTimestamps[0]!)), signal)
    }
  }

  private acquireConcurrencySlot(maxConcurrent: number, signal?: AbortSignal): Promise<void> {
    throwIfAborted(signal)

    if (this.inFlight < maxConcurrent) {
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

  private async readConfig(): Promise<RateLimitConfig> {
    const raw = typeof this.config === 'function' ? await this.config() : this.config
    return clampRateLimitConfig(raw)
  }

  private prune(now: number, windowMs: number): void {
    while (this.requestTimestamps.length > 0 && now - this.requestTimestamps[0]! >= windowMs) {
      this.requestTimestamps.shift()
    }
  }
}

function clampRateLimitConfig(config: RateLimitConfig | null | undefined): RateLimitConfig {
  const maxRequests =
    config && Number.isFinite(config.maxRequests) ? Math.max(1, Math.trunc(config.maxRequests)) : 1
  const windowMs =
    config && Number.isFinite(config.windowMs) ? Math.max(1, Math.trunc(config.windowMs)) : 1_000
  const maxConcurrent =
    config?.maxConcurrent !== undefined && Number.isFinite(config.maxConcurrent)
      ? Math.max(1, Math.trunc(config.maxConcurrent))
      : undefined

  return {
    maxRequests,
    windowMs,
    ...(maxConcurrent !== undefined ? { maxConcurrent } : {})
  }
}
