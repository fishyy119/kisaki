/**
 * Activity module hook points.
 *
 * Owned by ActivityService and dispatched around media consumption:
 * `gameLaunching` transforms the effective launch configuration right before
 * the launch is executed (never persisted), `sessionEnding` transforms a
 * session record before it is persisted, and the notify hooks fire after the
 * fact. Watch hooks are notify-only: playback outcome is a fact, and the
 * subscribers that mirror it to remote services must not alter it.
 */

import {
  createNotifyHook,
  createWaterfallHook,
  type NotifyHook,
  type WaterfallHook
} from '@main/hooks'
import type { Game } from '@shared/db'

export interface GameLaunchConfig {
  gameId: string
  launcherMode: Game['launcherMode']
  launcherPath: string
  gameDirPath: string | null
}

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

export interface AnimeWatchStartedPayload {
  animeId: string
  episodeId: string
}

export interface AnimeWatchEndedPayload {
  animeId: string
  episodeId: string
  /** Whether the session reached the point that counts the episode as watched. */
  watched: boolean
  /** Total session duration in seconds. */
  watchTimeSeconds: number
}

export interface ActivityHooks {
  gameLaunching: WaterfallHook<GameLaunchConfig>
  sessionStarted: NotifyHook<GameSessionStartedPayload>
  sessionEnding: WaterfallHook<GameSessionRecord>
  sessionEnded: NotifyHook<GameSessionEndedPayload>
  watchStarted: NotifyHook<AnimeWatchStartedPayload>
  watchEnded: NotifyHook<AnimeWatchEndedPayload>
}

export function createActivityHooks(): ActivityHooks {
  return {
    gameLaunching: createWaterfallHook<GameLaunchConfig>('play.game.launching'),
    sessionStarted: createNotifyHook<GameSessionStartedPayload>('play.session.started'),
    sessionEnding: createWaterfallHook<GameSessionRecord>('play.session.ending'),
    sessionEnded: createNotifyHook<GameSessionEndedPayload>('play.session.ended'),
    watchStarted: createNotifyHook<AnimeWatchStartedPayload>('play.anime.watch.started'),
    watchEnded: createNotifyHook<AnimeWatchEndedPayload>('play.anime.watch.ended')
  }
}
