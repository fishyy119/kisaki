import type { HookPointSpec } from './point'

export type GameLauncherMode = 'file' | 'url' | 'exec'

/** Effective launch configuration, transformable right before launch. */
export interface GameLaunchConfig {
  gameId: string
  launcherMode: GameLauncherMode
  launcherPath: string
  gameDirPath: string | null
}

export interface GameSessionStartedPayload {
  gameId: string
  pid: number
}

/** One play-session segment record, transformable before it is persisted. */
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

/**
 * Play hook points.
 *
 * `play.game.launching` and `play.session.ending` are waterfall transforms
 * before the launch / persist; session start and end are notifications. Watch
 * points are notify-only: the outcome of a playback session is a fact, and the
 * subscribers that mirror it to remote services must not alter it.
 */
export interface PlayHookPoints {
  'play.game.launching': HookPointSpec<'waterfall', GameLaunchConfig>
  'play.session.started': HookPointSpec<'notify', GameSessionStartedPayload>
  'play.session.ending': HookPointSpec<'waterfall', GameSessionRecord>
  'play.session.ended': HookPointSpec<'notify', GameSessionEndedPayload>
  'play.anime.watch.started': HookPointSpec<'notify', AnimeWatchStartedPayload>
  'play.anime.watch.ended': HookPointSpec<'notify', AnimeWatchEndedPayload>
}
