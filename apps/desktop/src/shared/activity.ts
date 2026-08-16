/**
 * Shared media activity contracts.
 *
 * Every expected start/stop outcome travels as data, so callers never inspect
 * error text. Reason values are named after the `activity` message keys that
 * describe them, letting a caller render an outcome with one catalog lookup.
 */

import type { GameLauncherMode, GameMonitorMode } from './db/contracts/enums'

/** Push payload for game activity lifecycle events. */
export interface GameActivityEvent {
  gameId: string
  /** Present on the started event when the process pid is known. */
  pid?: number
}

/** Live consumption state of one game, as tracked by the activity service. */
export interface GameRunningStatus {
  gameId: string
  isRunning: boolean
  isForeground: boolean
  processName?: string
  pid?: number
  exePath?: string
  startTime?: number
}

/** Launch and monitor columns a game's process match rule is derived from. */
export interface GameMonitorPathConfig {
  monitorPath: string | null
  monitorMode: GameMonitorMode
  gameDirPath: string | null
  launcherMode: GameLauncherMode
  launcherPath: string | null
}

export type GameLaunchUnconfirmedReason = 'monitorUnavailable' | 'processNotDetected'

export type GameLaunchFailureReason =
  | 'gameNotFound'
  | 'launcherPathNotSet'
  | 'fileNotFound'
  | 'executableNotFound'
  | 'openFileFailed'
  | 'invalidUrl'

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

export type AnimeWatchFailureReason =
  | 'alreadyWatching'
  | 'animeNotFound'
  | 'episodeNotFound'
  | 'noPlayableEpisode'
  | 'noEpisodeFile'
  | 'fileNotFound'
  | 'playerUnavailable'
  | 'playerStartFailed'

export type AnimeWatchResult =
  | { status: 'started'; episodeId: string; sessionId: string }
  | { status: 'failed'; reason: AnimeWatchFailureReason }

export type AnimeExtraPlayFailureReason =
  | 'alreadyPlaying'
  | 'extraNotFound'
  | 'noExtraFile'
  | 'fileNotFound'
  | 'playerUnavailable'
  | 'playerStartFailed'

/** Extras carry no watch state; their sessions are tracked but never recorded. */
export type AnimeExtraPlayResult =
  | { status: 'started'; sessionId: string }
  | { status: 'failed'; reason: AnimeExtraPlayFailureReason }

/** Live watching state of one anime, as tracked by the activity service. */
export interface AnimeWatchingState {
  animeId: string
  episodeId: string
  /** Player session id, correlating this watch with `player:*` pushes. */
  sessionId: string
}

/** Live playback state of one extra, as tracked by the activity service. */
export interface AnimeExtraPlayingState {
  animeId: string
  extraId: string
  /** Player session id, correlating this playback with `player:*` pushes. */
  sessionId: string
}

export type AnimeStopFailureReason = 'notWatching' | 'stopFailed'

export type AnimeStopResult =
  { status: 'stopped' } | { status: 'failed'; reason: AnimeStopFailureReason }

export type AnimeExtraStopFailureReason = 'notPlaying' | 'stopFailed'

export type AnimeExtraStopResult =
  { status: 'stopped' } | { status: 'failed'; reason: AnimeExtraStopFailureReason }

export type TvWatchFailureReason =
  | 'alreadyWatching'
  | 'tvNotFound'
  | 'episodeNotFound'
  | 'noPlayableEpisode'
  | 'noEpisodeFile'
  | 'fileNotFound'
  | 'playerUnavailable'
  | 'playerStartFailed'

export type TvWatchResult =
  | { status: 'started'; episodeId: string; sessionId: string }
  | { status: 'failed'; reason: TvWatchFailureReason }

export type TvExtraPlayFailureReason =
  | 'alreadyPlaying'
  | 'extraNotFound'
  | 'noExtraFile'
  | 'fileNotFound'
  | 'playerUnavailable'
  | 'playerStartFailed'

/** Extras carry no watch state; their sessions are tracked but never recorded. */
export type TvExtraPlayResult =
  { status: 'started'; sessionId: string } | { status: 'failed'; reason: TvExtraPlayFailureReason }

/** Live watching state of one show, as tracked by the activity service. */
export interface TvWatchingState {
  tvId: string
  episodeId: string
  /** Player session id, correlating this watch with `player:*` pushes. */
  sessionId: string
}

/** Live playback state of one extra, as tracked by the activity service. */
export interface TvExtraPlayingState {
  tvId: string
  extraId: string
  /** Player session id, correlating this playback with `player:*` pushes. */
  sessionId: string
}

export type TvStopFailureReason = 'notWatching' | 'stopFailed'

export type TvStopResult = { status: 'stopped' } | { status: 'failed'; reason: TvStopFailureReason }

export type TvExtraStopFailureReason = 'notPlaying' | 'stopFailed'

export type TvExtraStopResult =
  { status: 'stopped' } | { status: 'failed'; reason: TvExtraStopFailureReason }

export type MovieWatchFailureReason =
  | 'alreadyWatching'
  | 'movieNotFound'
  | 'noMovieFile'
  | 'fileNotFound'
  | 'playerUnavailable'
  | 'playerStartFailed'

/** A movie is one unit, so the started result names the file rather than a part. */
export type MovieWatchResult =
  | { status: 'started'; fileId: string; sessionId: string }
  | { status: 'failed'; reason: MovieWatchFailureReason }

export type MovieExtraPlayFailureReason =
  | 'alreadyPlaying'
  | 'extraNotFound'
  | 'noExtraFile'
  | 'fileNotFound'
  | 'playerUnavailable'
  | 'playerStartFailed'

/** Extras carry no watch state; their sessions are tracked but never recorded. */
export type MovieExtraPlayResult =
  | { status: 'started'; sessionId: string }
  | { status: 'failed'; reason: MovieExtraPlayFailureReason }

/** Live watching state of one movie, as tracked by the activity service. */
export interface MovieWatchingState {
  movieId: string
  fileId: string
  /** Player session id, correlating this watch with `player:*` pushes. */
  sessionId: string
}

/** Live playback state of one extra, as tracked by the activity service. */
export interface MovieExtraPlayingState {
  movieId: string
  extraId: string
  /** Player session id, correlating this playback with `player:*` pushes. */
  sessionId: string
}

export type MovieStopFailureReason = 'notWatching' | 'stopFailed'

export type MovieStopResult =
  { status: 'stopped' } | { status: 'failed'; reason: MovieStopFailureReason }

export type MovieExtraStopFailureReason = 'notPlaying' | 'stopFailed'

export type MovieExtraStopResult =
  { status: 'stopped' } | { status: 'failed'; reason: MovieExtraStopFailureReason }
