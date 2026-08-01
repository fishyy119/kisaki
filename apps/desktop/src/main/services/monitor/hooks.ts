/**
 * Monitor module hook points.
 *
 * Owned by MonitorService and dispatched by the game monitor around play
 * sessions: `sessionEnding` runs before a session record is persisted, the
 * notify hooks fire after the fact.
 */

import {
  createNotifyHook,
  createWaterfallHook,
  type NotifyHook,
  type WaterfallHook
} from '@main/hooks'

export interface GameSessionStartedPayload {
  gameId: string
  pid: number
}

export interface GameSessionRecord {
  gameId: string
  /** Foreground play duration for this session segment, in milliseconds. */
  durationMs: number
}

export interface GameSessionEndedPayload {
  gameId: string
  /** Total session duration in seconds. */
  playTimeSeconds: number
}

export interface MonitorHooks {
  sessionStarted: NotifyHook<GameSessionStartedPayload>
  /** Transforms a session record (e.g. corrects duration) before it is persisted. */
  sessionEnding: WaterfallHook<GameSessionRecord>
  sessionEnded: NotifyHook<GameSessionEndedPayload>
}

export function createMonitorHooks(): MonitorHooks {
  return {
    sessionStarted: createNotifyHook<GameSessionStartedPayload>('play.session.started'),
    sessionEnding: createWaterfallHook<GameSessionRecord>('play.session.ending'),
    sessionEnded: createNotifyHook<GameSessionEndedPayload>('play.session.ended')
  }
}
