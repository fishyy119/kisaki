export interface ExtensionHostCrashDecision {
  delayMs: number
  restart: boolean
}

/**
 * Applies a bounded backoff so the extension host can recover from transient crashes
 * without entering an endless restart loop.
 */
export class ExtensionHostCrashPolicy {
  private readonly crashTimestamps: number[] = []

  constructor(
    private readonly maxCrashes = 3,
    private readonly windowMs = 30_000,
    private readonly baseDelayMs = 500,
    private readonly maxDelayMs = 5_000
  ) {}

  recordCrash(now = Date.now()): ExtensionHostCrashDecision {
    this.prune(now)
    this.crashTimestamps.push(now)

    if (this.crashTimestamps.length > this.maxCrashes) {
      return {
        restart: false,
        delayMs: 0
      }
    }

    const delayMs = Math.min(
      this.baseDelayMs * Math.pow(2, this.crashTimestamps.length - 1),
      this.maxDelayMs
    )

    return {
      restart: true,
      delayMs
    }
  }

  reset(): void {
    this.crashTimestamps.length = 0
  }

  private prune(now: number): void {
    const threshold = now - this.windowMs
    while (this.crashTimestamps.length > 0 && this.crashTimestamps[0]! < threshold) {
      this.crashTimestamps.shift()
    }
  }
}
