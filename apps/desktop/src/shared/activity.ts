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
  /** Playback session id, correlating this watch with `video:*` pushes. */
  sessionId: string
}

/** Live playback state of one extra, as tracked by the activity service. */
export interface AnimeExtraPlayingState {
  animeId: string
  extraId: string
  /** Playback session id, correlating this playback with `video:*` pushes. */
  sessionId: string
}

export type AnimeStopFailureReason = 'notWatching' | 'stopFailed'

export type AnimeStopResult =
  { status: 'stopped' } | { status: 'failed'; reason: AnimeStopFailureReason }

export type AnimeExtraStopFailureReason = 'notPlaying' | 'stopFailed'

export type AnimeExtraStopResult =
  { status: 'stopped' } | { status: 'failed'; reason: AnimeExtraStopFailureReason }

export type ComicReadFailureReason =
  'comicNotFound' | 'chapterNotFound' | 'noReadableChapter' | 'noChapterFile' | 'fileNotFound'

/** `refocused` re-aims the entry's open reader window instead of opening a second one. */
export type ComicReadResult =
  | { status: 'started'; chapterId: string }
  | { status: 'refocused'; chapterId: string }
  | { status: 'failed'; reason: ComicReadFailureReason }

export type NovelReadFailureReason =
  'novelNotFound' | 'volumeNotFound' | 'noReadableVolume' | 'noVolumeFile' | 'fileNotFound'

/** `refocused` re-aims the entry's open reader window instead of opening a second one. */
export type NovelReadResult =
  | { status: 'started'; volumeId: string }
  | { status: 'refocused'; volumeId: string }
  | { status: 'failed'; reason: NovelReadFailureReason }

/** Live reading state of one comic, as tracked by the activity service. */
export interface ComicReadingState {
  comicId: string
  chapterId: string
}

/** Live reading state of one novel, as tracked by the activity service. */
export interface NovelReadingState {
  novelId: string
  volumeId: string
}
