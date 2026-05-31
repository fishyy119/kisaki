import type { TaskRunProgress, TaskRunProgressUpdate } from '@shared/task-run'

interface RateSample {
  at: number
  current: number
}

export class TaskRunRateCalculator {
  private lastSample?: RateSample
  private unit?: string
  private current?: number
  private total?: number

  apply(
    update: TaskRunProgressUpdate,
    now: number
  ): Pick<TaskRunProgress, 'rate' | 'etaMs' | 'percent'> {
    const current = update.current
    const total = update.total

    if (this.shouldReset(update)) {
      this.lastSample = undefined
    }

    const percent = computePercent(current, total)
    let rate: number | undefined
    let etaMs: number | undefined

    if (isNonNegativeFiniteNumber(current)) {
      const previousSample = this.lastSample
      if (previousSample && previousSample.at < now && previousSample.current < current) {
        const elapsedMs = now - previousSample.at
        rate = (current - previousSample.current) / (elapsedMs / 1000)
        if (isNonNegativeFiniteNumber(total) && total > current && rate > 0) {
          etaMs = ((total - current) / rate) * 1000
        }
      }
      this.lastSample = { at: now, current }
    } else {
      this.lastSample = undefined
    }

    this.unit = update.unit
    this.current = current
    this.total = total

    const metrics: Pick<TaskRunProgress, 'rate' | 'etaMs' | 'percent'> = {}
    if (rate !== undefined) {
      metrics.rate = rate
    }
    if (etaMs !== undefined) {
      metrics.etaMs = etaMs
    }
    if (percent !== undefined) {
      metrics.percent = percent
    }

    return metrics
  }

  reset(): void {
    this.lastSample = undefined
    this.unit = undefined
    this.current = undefined
    this.total = undefined
  }

  private shouldReset(update: TaskRunProgressUpdate): boolean {
    if (this.unit !== update.unit) {
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
