import type { TaskRunProgress, TaskRunProgressUpdate } from '@shared/task-run'

const RATE_WINDOW_MS = 10_000

interface RateSample {
  at: number
  current: number
}

export class TaskRunRateCalculator {
  private samples: RateSample[] = []
  private phase?: string
  private unit?: string
  private current?: number
  private total?: number

  apply(
    update: TaskRunProgressUpdate,
    now: number
  ): Pick<TaskRunProgress, 'rate' | 'rateWindowMs' | 'etaMs' | 'percent'> {
    const current = update.current
    const total = update.total

    if (this.shouldReset(update)) {
      this.samples = []
    }

    const percent = computePercent(current, total)
    let rate: number | undefined
    let rateWindowMs: number | undefined
    let etaMs: number | undefined

    if (isNonNegativeFiniteNumber(current)) {
      this.samples.push({ at: now, current })
      this.samples = this.samples.filter((sample) => now - sample.at <= RATE_WINDOW_MS)

      const first = this.samples[0]
      const last = this.samples[this.samples.length - 1]
      if (first && last && last.at > first.at && last.current > first.current) {
        rateWindowMs = last.at - first.at
        rate = (last.current - first.current) / (rateWindowMs / 1000)
        if (isNonNegativeFiniteNumber(total) && total > current && rate > 0) {
          etaMs = ((total - current) / rate) * 1000
        }
      }
    } else {
      this.samples = []
    }

    this.phase = update.phase
    this.unit = update.unit
    this.current = current
    this.total = total

    return { rate, rateWindowMs, etaMs, percent }
  }

  reset(): void {
    this.samples = []
    this.phase = undefined
    this.unit = undefined
    this.current = undefined
    this.total = undefined
  }

  private shouldReset(update: TaskRunProgressUpdate): boolean {
    if (this.phase !== update.phase || this.unit !== update.unit) {
      return true
    }

    if (
      isNonNegativeFiniteNumber(this.current) &&
      isNonNegativeFiniteNumber(update.current) &&
      update.current < this.current
    ) {
      return true
    }

    if (this.total === undefined && update.total === undefined) {
      return false
    }

    if (!isNonNegativeFiniteNumber(this.total) || !isNonNegativeFiniteNumber(update.total)) {
      return this.total !== update.total
    }

    const threshold = Math.max(1, this.total * 0.1)
    return Math.abs(update.total - this.total) > threshold
  }
}

function computePercent(
  current: number | undefined,
  total: number | undefined
): number | undefined {
  if (!isNonNegativeFiniteNumber(current) || !isNonNegativeFiniteNumber(total) || total <= 0) {
    return undefined
  }

  return Math.min(100, (current / total) * 100)
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}
