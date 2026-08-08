import { createLogger } from '@main/log'
import { assertNotAborted, Semaphore, sleep } from '@main/utils/async'
import type { RateLimitConfig } from '@shared/network'

const log = createLogger('Network')

export interface NetworkRateLimitApi {
  register(key: string, config: RateLimitConfig): void
  unregister(key: string): void
}

export interface NetworkRateLimitGate {
  waitForSlot(key: string, signal?: AbortSignal): Promise<void>
}

export class NetworkRateLimitRegistry implements NetworkRateLimitGate {
  private readonly limiters = new Map<string, RateLimiter>()

  readonly api: NetworkRateLimitApi = {
    register: (key, config) => this.register(key, config),
    unregister: (key) => this.unregister(key)
  }

  private register(key: string, config: RateLimitConfig): void {
    this.limiters.set(key, new RateLimiter(config))
    log.debug('Registered rate limit.', {
      key: key,
      configMaxRequests: config.maxRequests,
      configWindowMs: config.windowMs
    })
  }

  private unregister(key: string): void {
    this.limiters.delete(key)
  }

  async waitForSlot(key: string, signal?: AbortSignal): Promise<void> {
    const limiter = this.limiters.get(key)
    if (limiter) {
      await limiter.wait(signal)
    }
  }
}

/**
 * Sliding window rate limiter.
 *
 * Waiters queue on a mutex so the window is inspected by one caller at a time.
 * A cancelled waiter leaves both the queue and the window without consuming a
 * slot, so cancelling a long scrape frees its remaining quota for whatever runs
 * next instead of holding the window until the sleep elapses.
 */
class RateLimiter {
  private readonly maxRequests: number
  private readonly windowMs: number
  private readonly mutex = new Semaphore(1)
  private requestTimestamps: number[] = []

  constructor(config: RateLimitConfig) {
    this.maxRequests = config.maxRequests
    this.windowMs = config.windowMs
  }

  async wait(signal?: AbortSignal): Promise<void> {
    await this.mutex.run(() => this.acquireSlot(signal), signal)
  }

  private async acquireSlot(signal: AbortSignal | undefined): Promise<void> {
    while (true) {
      assertNotAborted(signal)

      const now = Date.now()
      const windowStart = now - this.windowMs

      this.requestTimestamps = this.requestTimestamps.filter((t) => t > windowStart)

      if (this.requestTimestamps.length < this.maxRequests) {
        this.requestTimestamps.push(now)
        return
      }

      const oldestTimestamp = this.requestTimestamps[0]
      const waitTime = oldestTimestamp + this.windowMs - now + 1

      if (waitTime > 0) {
        await sleep(waitTime, signal)
      }
    }
  }
}
