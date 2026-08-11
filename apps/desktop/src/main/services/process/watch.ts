/**
 * Process watch namespace.
 *
 * Polls the OS process list and reports start, stop, and foreground edges for
 * every registered watch. Foreground leaving edges are buffered so a brief
 * alt-tab does not split a run into fragments; the buffer window counts as
 * foreground time, because the user is still in the activity.
 */

import { getProcesses, type ProcessInfo } from '@ximu3/process-list'
import { dirname, normalize } from 'node:path'
import { createLogger } from '@main/log'
import type { ProcessHooks } from './hooks'
import type { ProcessMatchRule, ProcessWatchStatus } from './types'

const log = createLogger('Process')

const POLL_INTERVAL_MS = 1000
const FOREGROUND_BUFFER_MS = 60000

interface WatchEntry {
  watchId: string
  rule: ProcessMatchRule
  isRunning: boolean
  isForeground: boolean
  pid?: number
  processName?: string
  exePath?: string
  startedAt?: number
  foregroundStartedAt?: number
  backgroundTimer?: NodeJS.Timeout
}

export class ProcessWatcher {
  private readonly watches = new Map<string, WatchEntry>()
  private pollTimer?: NodeJS.Timeout
  private activePoll: Promise<void> | null = null

  constructor(private readonly hooks: ProcessHooks) {}

  /**
   * Registers a watch, replacing an idle watch with the same id. A watch whose
   * process is currently detected is left untouched so a re-registration never
   * truncates a run.
   */
  start(watchId: string, rule: ProcessMatchRule): void {
    const existing = this.watches.get(watchId)
    if (existing?.isRunning) {
      return
    }
    if (existing) {
      this.clearBackgroundTimer(existing)
    }

    this.watches.set(watchId, { watchId, rule, isRunning: false, isForeground: false })
    this.ensurePolling()
  }

  /** Removes a watch, emitting the closing edges when it is still running. */
  stop(watchId: string): void {
    const entry = this.watches.get(watchId)
    if (!entry) {
      return
    }

    if (entry.isRunning) {
      this.handleStopped(entry)
    }
    this.clearBackgroundTimer(entry)
    this.watches.delete(watchId)
    this.stopPollingIfIdle()
  }

  get(watchId: string): ProcessWatchStatus | null {
    const entry = this.watches.get(watchId)
    return entry ? toStatus(entry) : null
  }

  list(): ProcessWatchStatus[] {
    return [...this.watches.values()].map(toStatus)
  }

  /** Polls until the watch is detected as running, or the timeout elapses. */
  async waitForRunning(watchId: string, timeoutMs: number): Promise<ProcessWatchStatus | null> {
    return this.pollUntil(watchId, timeoutMs, (status) => status?.isRunning === true)
  }

  /** Polls until the watch is no longer detected, or the timeout elapses. */
  async waitForStopped(watchId: string, timeoutMs: number): Promise<boolean> {
    const status = await this.pollUntil(watchId, timeoutMs, (entry) => !entry?.isRunning)
    return status !== null
  }

  async dispose(): Promise<void> {
    for (const watchId of [...this.watches.keys()]) {
      this.stop(watchId)
    }

    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = undefined
    }
  }

  private async pollUntil(
    watchId: string,
    timeoutMs: number,
    predicate: (status: ProcessWatchStatus | null) => boolean
  ): Promise<ProcessWatchStatus | null> {
    if (predicate(this.get(watchId))) {
      return this.get(watchId) ?? { watchId, isRunning: false, isForeground: false }
    }

    const deadline = Date.now() + timeoutMs
    while (Date.now() <= deadline) {
      await this.poll()

      const status = this.get(watchId)
      if (predicate(status)) {
        return status ?? { watchId, isRunning: false, isForeground: false }
      }

      const remainingMs = deadline - Date.now()
      if (remainingMs <= 0) {
        break
      }
      await delay(Math.min(POLL_INTERVAL_MS, remainingMs))
    }

    return null
  }

  private ensurePolling(): void {
    if (this.pollTimer) {
      return
    }

    this.pollTimer = setInterval(() => {
      this.poll().catch((error) => log.error('Process poll failed.', error))
    }, POLL_INTERVAL_MS)
  }

  private stopPollingIfIdle(): void {
    if (this.watches.size === 0 && this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = undefined
    }
  }

  /** Coalesces concurrent polls so timer ticks and waiters share one OS scan. */
  private async poll(): Promise<void> {
    if (this.activePoll) {
      return this.activePoll
    }

    this.activePoll = this.pollNow().finally(() => {
      this.activePoll = null
    })
    return this.activePoll
  }

  private async pollNow(): Promise<void> {
    if (this.watches.size === 0) {
      return
    }

    const processes = getProcesses()
    for (const entry of this.watches.values()) {
      const match = findMatchingProcess(processes, entry.rule)

      if (!entry.isRunning && match) {
        this.handleStarted(entry, match)
      } else if (entry.isRunning && !match) {
        this.handleStopped(entry)
      }

      if (entry.isRunning && match) {
        if (match.isForeground) {
          this.enterForeground(entry)
        } else {
          this.scheduleLeaveForeground(entry)
        }
      }
    }
  }

  private handleStarted(entry: WatchEntry, match: ProcessInfo): void {
    const now = Date.now()
    entry.isRunning = true
    entry.pid = match.pid
    entry.processName = match.name
    entry.exePath = match.path
    entry.startedAt = now
    entry.isForeground = false
    entry.foregroundStartedAt = undefined

    this.hooks.processStarted.dispatch({
      watchId: entry.watchId,
      pid: match.pid,
      processName: match.name,
      ...(match.path ? { exePath: match.path } : {})
    })

    if (match.isForeground) {
      this.enterForeground(entry)
    }
  }

  /** Emits the pending foreground leaving edge first, so time is never lost. */
  private handleStopped(entry: WatchEntry): void {
    const elapsedMs = entry.startedAt ? Date.now() - entry.startedAt : 0
    this.clearBackgroundTimer(entry)
    this.leaveForeground(entry)

    entry.isRunning = false
    entry.pid = undefined
    entry.processName = undefined
    entry.exePath = undefined
    entry.startedAt = undefined

    this.hooks.processStopped.dispatch({ watchId: entry.watchId, elapsedMs })
  }

  private enterForeground(entry: WatchEntry): void {
    this.clearBackgroundTimer(entry)
    if (entry.isForeground) {
      return
    }

    entry.isForeground = true
    entry.foregroundStartedAt = Date.now()
    this.hooks.foregroundChanged.dispatch({ watchId: entry.watchId, isForeground: true })
  }

  private scheduleLeaveForeground(entry: WatchEntry): void {
    if (!entry.isForeground || entry.backgroundTimer) {
      return
    }

    entry.backgroundTimer = setTimeout(() => {
      entry.backgroundTimer = undefined
      this.leaveForeground(entry)
    }, FOREGROUND_BUFFER_MS)
  }

  private leaveForeground(entry: WatchEntry): void {
    if (!entry.isForeground) {
      return
    }

    const foregroundMs = entry.foregroundStartedAt ? Date.now() - entry.foregroundStartedAt : 0
    entry.isForeground = false
    entry.foregroundStartedAt = undefined
    this.hooks.foregroundChanged.dispatch({
      watchId: entry.watchId,
      isForeground: false,
      foregroundMs
    })
  }

  private clearBackgroundTimer(entry: WatchEntry): void {
    if (entry.backgroundTimer) {
      clearTimeout(entry.backgroundTimer)
      entry.backgroundTimer = undefined
    }
  }
}

function toStatus(entry: WatchEntry): ProcessWatchStatus {
  return {
    watchId: entry.watchId,
    isRunning: entry.isRunning,
    isForeground: entry.isForeground,
    ...(entry.pid === undefined ? {} : { pid: entry.pid }),
    ...(entry.processName === undefined ? {} : { processName: entry.processName }),
    ...(entry.exePath === undefined ? {} : { exePath: entry.exePath }),
    ...(entry.startedAt === undefined ? {} : { startedAt: entry.startedAt })
  }
}

function findMatchingProcess(
  processes: readonly ProcessInfo[],
  rule: ProcessMatchRule
): ProcessInfo | undefined {
  switch (rule.mode) {
    case 'file': {
      const target = normalizePath(rule.value)
      return processes.find((item) => item.path && normalizePath(item.path) === target)
    }
    case 'folder': {
      const folder = normalizePath(rule.value)
      return processes.find((item) => {
        if (!item.path) return false
        const path = normalizePath(item.path)
        return dirname(path).startsWith(folder) || path.startsWith(folder)
      })
    }
    case 'process': {
      const name = rule.value.toLowerCase()
      return processes.find((item) => item.name.toLowerCase() === name)
    }
  }
}

function normalizePath(path: string): string {
  return normalize(path).toLowerCase()
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
