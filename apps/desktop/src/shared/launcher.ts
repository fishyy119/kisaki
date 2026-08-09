/**
 * Shared launcher result contracts.
 *
 * Every expected launch/stop outcome travels as data, so callers never inspect
 * error text. Reason values are named after the `launcher` message keys that
 * describe them, letting a caller render an outcome with one catalog lookup.
 */

export type GameLaunchUnconfirmedReason = 'monitorUnavailable' | 'processNotDetected'

export type GameLaunchFailureReason =
  | 'gameNotFound'
  | 'launcherPathNotSet'
  | 'fileNotFound'
  | 'executableNotFound'
  | 'openFileFailed'
  | 'invalidUrl'
  | 'unknownMode'

export type GameStopFailureReason = 'gameNotRunning' | 'stopProcessFailed'

export type GameLaunchResult =
  | { status: 'detected'; pid?: number }
  | { status: 'cancelled' }
  | { status: 'unconfirmed'; reason: GameLaunchUnconfirmedReason }
  | { status: 'failed'; reason: GameLaunchFailureReason }

export type GameStopResult =
  | { status: 'stopped' }
  | { status: 'unconfirmed' }
  | { status: 'failed'; reason: GameStopFailureReason }
