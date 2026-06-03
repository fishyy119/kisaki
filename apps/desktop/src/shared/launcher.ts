/**
 * Shared launcher result contracts.
 */

export type GameLaunchUnconfirmedReason = 'monitor-unavailable' | 'process-not-detected'
export type GameStopUnconfirmedReason = 'process-still-running'

export type GameLaunchResult =
  | { status: 'detected'; pid?: number }
  | { status: 'cancelled' }
  | { status: 'unconfirmed'; reason: GameLaunchUnconfirmedReason }

export type GameStopResult =
  | { status: 'stopped' }
  | { status: 'unconfirmed'; reason: GameStopUnconfirmedReason }
