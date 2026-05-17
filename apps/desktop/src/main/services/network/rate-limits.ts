import { createLogger } from '@main/log'
import type { RateLimitConfig } from '@shared/network'

const log = createLogger('Network')

export interface NetworkRateLimitApi {
  register(key: string, config: RateLimitConfig): void
  unregister(key: string): void
}

export interface NetworkRateLimitGate {
  waitForSlot(key: string): Promise<void>
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

  async waitForSlot(key: string): Promise<void> {
    const limiter = this.limiters.get(key)
    if (limiter) {
      await limiter.wait()
    }
  }
}

/**
 * Sliding window rate limiter with mutex.
 */
class RateLimiter {
  private readonly maxRequests: number
  private readonly windowMs: number
  private requestTimestamps: number[] = []
  private waitQueue: Array<() => void> = []
  private processing = false

  constructor(config: RateLimitConfig) {
    this.maxRequests = config.maxRequests
    this.windowMs = config.windowMs
  }

  async wait(): Promise<void> {
    if (this.processing) {
      await new Promise<void>((resolve) => this.waitQueue.push(resolve))
    }

    this.processing = true

    try {
      await this.acquireSlot()
    } finally {
      this.processing = false
      const next = this.waitQueue.shift()
      if (next) next()
    }
  }

  private async acquireSlot(): Promise<void> {
    while (true) {
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
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }
    }
  }
}
