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

/**
 * Play hook points.
 *
 * `play.game.launching` and `play.session.ending` are waterfall transforms
 * before the launch / persist; session start and end are notifications.
 */
export interface PlayHookPoints {
  'play.game.launching': HookPointSpec<'waterfall', GameLaunchConfig>
  'play.session.started': HookPointSpec<'notify', GameSessionStartedPayload>
  'play.session.ending': HookPointSpec<'waterfall', GameSessionRecord>
  'play.session.ended': HookPointSpec<'notify', GameSessionEndedPayload>
}
