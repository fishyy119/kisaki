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

export interface ComicReadStartedPayload {
  comicId: string
  chapterId: string
}

export interface ComicReadEndedPayload {
  comicId: string
  /** Total reading duration across the window's session, in seconds. */
  readTimeSeconds: number
}

export interface NovelReadStartedPayload {
  novelId: string
  volumeId: string
}

export interface NovelReadEndedPayload {
  novelId: string
  /** Total reading duration across the window's session, in seconds. */
  readTimeSeconds: number
}

/**
 * Play hook points.
 *
 * `play.game.launching` and `play.game.session.ending` are waterfall
 * transforms before the launch / persist; session start and end are
 * notifications. Watch and read points are notify-only: the outcome of a
 * consumption session is a fact, and the subscribers that mirror it to remote
 * services must not alter it.
 */
export interface PlayHookPoints {
  'play.game.launching': HookPointSpec<'waterfall', GameLaunchConfig>
  'play.game.session.started': HookPointSpec<'notify', GameSessionStartedPayload>
  'play.game.session.ending': HookPointSpec<'waterfall', GameSessionRecord>
  'play.game.session.ended': HookPointSpec<'notify', GameSessionEndedPayload>
  'play.anime.watch.started': HookPointSpec<'notify', AnimeWatchStartedPayload>
  'play.anime.watch.ended': HookPointSpec<'notify', AnimeWatchEndedPayload>
  'play.comic.read.started': HookPointSpec<'notify', ComicReadStartedPayload>
  'play.comic.read.ended': HookPointSpec<'notify', ComicReadEndedPayload>
  'play.novel.read.started': HookPointSpec<'notify', NovelReadStartedPayload>
  'play.novel.read.ended': HookPointSpec<'notify', NovelReadEndedPayload>
}
