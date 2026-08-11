/**
 * Process service contracts.
 *
 * Domain-agnostic: a watch is an opaque caller id plus a match rule, and every
 * expected start outcome travels as data so callers never inspect error text.
 */

export type ProcessLaunchFailureReason =
  | 'fileNotFound'
  | 'openFileFailed'
  | 'invalidUrl'
  | 'executableNotFound'

export type ProcessLaunchResult =
  | { status: 'started' }
  | { status: 'failed'; reason: ProcessLaunchFailureReason }

/** How a running process is recognized as belonging to a watch. */
export type ProcessMatchMode = 'file' | 'folder' | 'process'

export interface ProcessMatchRule {
  mode: ProcessMatchMode
  /** Executable path, containing folder, or process name, per {@link mode}. */
  value: string
}

export interface ProcessWatchStatus {
  watchId: string
  isRunning: boolean
  isForeground: boolean
  pid?: number
  processName?: string
  exePath?: string
  /** Wall-clock milliseconds when the current run was first detected. */
  startedAt?: number
}

export interface ProcessStartedPayload {
  watchId: string
  pid: number
  processName: string
  exePath?: string
}

export interface ProcessStoppedPayload {
  watchId: string
  /** Wall-clock milliseconds the process stayed detected. */
  elapsedMs: number
}

/**
 * Foreground transitions are already debounced by the watcher: a background
 * transition is only reported once the buffer window elapses without the
 * process returning to the foreground.
 */
export interface ProcessForegroundChangedPayload {
  watchId: string
  isForeground: boolean
  /** Milliseconds the process stayed in the foreground, on a leaving edge. */
  foregroundMs?: number
}
