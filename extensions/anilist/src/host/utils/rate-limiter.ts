import { setTimeout as sleep } from 'node:timers/promises'

export interface RateLimitConfig {
  /** Requests admitted per sliding window. */
  maxRequests: number
  windowMs: number
  /** Cap on simultaneously running tasks; omit for unbounded concurrency. */
  maxConcurrent?: number | undefined
}

interface RateWaiter {
  grant(): void
  reject(reason: unknown): void
  detachAbort?: () => void
}

/**
 * Sliding-window request gate with an optional concurrency cap.
 *
 * One scrape fans out into many upstream reads, so extensions pace requests
 * here instead of relying on 429 retries alone. The config may be a live
 * reader so settings changes take effect on the next request rather than at
 * the next app start; values are clamped defensively because readers hand
 * over user-editable data.
 *
 * Cancellations reject with the aborting signal's own reason (the native
 * `AbortError`); the RPC boundary classifies those as cancellations.
 */
export class RateLimiter {
  private readonly requestTimestamps: number[] = []
  private readonly rateWaiters: RateWaiter[] = []
  private readonly waitingForSlot: Array<() => void> = []
  private inFlight = 0
  private pumping = false

  constructor(private readonly config: RateLimitConfig | (() => Promise<RateLimitConfig>)) {}

  /**
   * Waits for a rate slot; callers issue the request themselves afterwards.
   * Waiters queue FIFO and an abort removes the waiter immediately — the
   * shared pump owns the window wait, so no waiter blocks on another's turn.
   */
  acquire(signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()

    return new Promise<void>((resolve, reject) => {
      const waiter: RateWaiter = {
        grant: () => {
          waiter.detachAbort?.()
          resolve()
        },
        reject
      }

      if (signal) {
        const onAbort = (): void => {
          const index = this.rateWaiters.indexOf(waiter)
          if (index >= 0) {
            this.rateWaiters.splice(index, 1)
          }
          waiter.reject(signal.reason)
        }

        signal.addEventListener('abort', onAbort, { once: true })
        waiter.detachAbort = () => signal.removeEventListener('abort', onAbort)
      }

      this.rateWaiters.push(waiter)
      void this.pumpRateWaiters()
    })
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

  /**
   * Single scheduler granting queued waiters in order. The window wait is a
   * shared condition, so the pump sleeps unsignalled; aborted waiters have
   * already left the queue by the time a slot frees.
   */
  private async pumpRateWaiters(): Promise<void> {
    if (this.pumping) {
      return
    }

    this.pumping = true
    try {
      while (this.rateWaiters.length > 0) {
        const { maxRequests, windowMs } = await this.readConfig()
        const now = Date.now()
        this.prune(now, windowMs)

        if (this.requestTimestamps.length < maxRequests) {
          const waiter = this.rateWaiters.shift()
          if (waiter) {
            this.requestTimestamps.push(now)
            waiter.grant()
          }
          continue
        }

        await sleep(Math.max(1, windowMs - (now - this.requestTimestamps[0]!)))
      }
    } finally {
      this.pumping = false
    }
  }

  private acquireConcurrencySlot(maxConcurrent: number, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()

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
        reject(signal?.reason)
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
