/**
 * Activity module hook points.
 *
 * Owned by ActivityService and dispatched around media consumption:
 * `gameLaunching` transforms the effective launch configuration right before
 * the launch is executed (never persisted), `gameSessionEnding` transforms a
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
  gameSessionStarted: NotifyHook<GameSessionStartedPayload>
  gameSessionEnding: WaterfallHook<GameSessionRecord>
  gameSessionEnded: NotifyHook<GameSessionEndedPayload>
  animeWatchStarted: NotifyHook<AnimeWatchStartedPayload>
  animeWatchEnded: NotifyHook<AnimeWatchEndedPayload>
}

export function createActivityHooks(): ActivityHooks {
  return {
    gameLaunching: createWaterfallHook<GameLaunchConfig>('play.game.launching'),
    gameSessionStarted: createNotifyHook<GameSessionStartedPayload>('play.game.session.started'),
    gameSessionEnding: createWaterfallHook<GameSessionRecord>('play.game.session.ending'),
    gameSessionEnded: createNotifyHook<GameSessionEndedPayload>('play.game.session.ended'),
    animeWatchStarted: createNotifyHook<AnimeWatchStartedPayload>('play.anime.watch.started'),
    animeWatchEnded: createNotifyHook<AnimeWatchEndedPayload>('play.anime.watch.ended')
  }
}
