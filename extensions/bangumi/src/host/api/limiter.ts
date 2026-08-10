import { createAbortError, throwIfAborted } from '../utils/errors'

export interface BangumiRateLimitConfig {
  maxRequests: number
  windowMs: number
}

const DEFAULT_RATE_LIMIT_CONFIG: BangumiRateLimitConfig = {
  maxRequests: 120,
  windowMs: 60_000
}

export class BangumiRateLimiter {
  private readonly requestTimestamps: number[] = []
  private queue = Promise.resolve()

  constructor(private readonly readConfig: () => Promise<BangumiRateLimitConfig>) {}

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
    while (true) {
      throwIfAborted(signal)

      const config = normalizeRateLimitConfig(await this.readConfig())
      const now = Date.now()
      this.prune(now, config.windowMs)

      if (this.requestTimestamps.length < config.maxRequests) {
        this.requestTimestamps.push(now)
        return
      }

      const waitMs = config.windowMs - (now - this.requestTimestamps[0]!)
      await delay(Math.max(1, waitMs), signal)
    }
  }

  private prune(now: number, windowMs: number): void {
    while (this.requestTimestamps.length > 0 && now - this.requestTimestamps[0]! >= windowMs) {
      this.requestTimestamps.shift()
    }
  }
}

export function normalizeRateLimitConfig(
  config: BangumiRateLimitConfig | null | undefined
): BangumiRateLimitConfig {
  if (
    !config ||
    !Number.isFinite(config.maxRequests) ||
    !Number.isFinite(config.windowMs) ||
    config.maxRequests < 1 ||
    config.windowMs < 1
  ) {
    return DEFAULT_RATE_LIMIT_CONFIG
  }

  return {
    maxRequests: Math.max(1, Math.trunc(config.maxRequests)),
    windowMs: Math.max(1, Math.trunc(config.windowMs))
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
      reject(createAbortError())
    }

    function cleanup(): void {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
