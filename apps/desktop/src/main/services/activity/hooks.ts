/**
 * Activity module hook points.
 *
 * Owned by ActivityService and dispatched around media consumption. Ids follow
 * `activity.<media>.<verb>.<edge>` with each media's own verb (game=play,
 * anime=watch, comic/novel=read): `gameLaunching` transforms the effective
 * launch configuration right before the process starts (never persisted),
 * `gamePlayEnding` transforms a session record before it is persisted, and the
 * notify hooks fire after the fact. Watch and read hooks are notify-only:
 * playback outcome is a fact, and the subscribers that mirror it to remote
 * services must not alter it.
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
  dirPath: string | null
}

export interface GamePlayStartedPayload {
  gameId: string
  pid: number
}

export interface GamePlayRecord {
  gameId: string
  /** Foreground play duration for this session segment, in milliseconds. */
  durationMs: number
}

export interface GamePlayEndedPayload {
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

export interface ActivityHooks {
  gameLaunching: WaterfallHook<GameLaunchConfig>
  gamePlayStarted: NotifyHook<GamePlayStartedPayload>
  gamePlayEnding: WaterfallHook<GamePlayRecord>
  gamePlayEnded: NotifyHook<GamePlayEndedPayload>
  animeWatchStarted: NotifyHook<AnimeWatchStartedPayload>
  animeWatchEnded: NotifyHook<AnimeWatchEndedPayload>
  comicReadStarted: NotifyHook<ComicReadStartedPayload>
  comicReadEnded: NotifyHook<ComicReadEndedPayload>
  novelReadStarted: NotifyHook<NovelReadStartedPayload>
  novelReadEnded: NotifyHook<NovelReadEndedPayload>
}

export function createActivityHooks(): ActivityHooks {
  return {
    gameLaunching: createWaterfallHook<GameLaunchConfig>('activity.game.launching'),
    gamePlayStarted: createNotifyHook<GamePlayStartedPayload>('activity.game.play.started'),
    gamePlayEnding: createWaterfallHook<GamePlayRecord>('activity.game.play.ending'),
    gamePlayEnded: createNotifyHook<GamePlayEndedPayload>('activity.game.play.ended'),
    animeWatchStarted: createNotifyHook<AnimeWatchStartedPayload>('activity.anime.watch.started'),
    animeWatchEnded: createNotifyHook<AnimeWatchEndedPayload>('activity.anime.watch.ended'),
    comicReadStarted: createNotifyHook<ComicReadStartedPayload>('activity.comic.read.started'),
    comicReadEnded: createNotifyHook<ComicReadEndedPayload>('activity.comic.read.ended'),
    novelReadStarted: createNotifyHook<NovelReadStartedPayload>('activity.novel.read.started'),
    novelReadEnded: createNotifyHook<NovelReadEndedPayload>('activity.novel.read.ended')
  }
}
