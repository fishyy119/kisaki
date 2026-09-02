import { LIBRARY_MEDIA_TYPES, type LibraryMediaType } from '../../../capabilities/library/graph'
import type { HookKind, HookPointSpec } from './point'

export type GameLauncherMode = 'file' | 'url' | 'exec'

/** Effective launch configuration, transformable right before launch. */
export interface GameLaunchConfig {
  gameId: string
  launcherMode: GameLauncherMode
  launcherPath: string
  dirPath: string | null
}

export interface GamePlayStartedPayload {
  gameId: string
  pid: number
}

/** One play-session segment record, transformable before it is persisted. */
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

/**
 * The consumption verb of each media type. Ids are
 * `activity.<media>.<verb>.<edge>`, so the umbrella word `activity` never
 * borrows a member's verb.
 */
export const ACTIVITY_VERBS = {
  game: 'play',
  anime: 'watch',
  comic: 'read',
  novel: 'read'
} as const satisfies Record<LibraryMediaType, string>

export type ActivityVerb<TMedia extends LibraryMediaType> = (typeof ACTIVITY_VERBS)[TMedia]

/** Session edges every media type reports. */
export const ACTIVITY_SESSION_EDGES = ['started', 'ended'] as const

export type ActivitySessionEdge = (typeof ACTIVITY_SESSION_EDGES)[number]

/** Per-media session payloads; adding a media type must add its pair here. */
interface ActivitySessionPayloads {
  game: { started: GamePlayStartedPayload; ended: GamePlayEndedPayload }
  anime: { started: AnimeWatchStartedPayload; ended: AnimeWatchEndedPayload }
  comic: { started: ComicReadStartedPayload; ended: ComicReadEndedPayload }
  novel: { started: NovelReadStartedPayload; ended: NovelReadEndedPayload }
}

type ActivitySessionPointsFor<TEdge extends ActivitySessionEdge> = {
  [
    TMedia in LibraryMediaType as `activity.${TMedia}.${ActivityVerb<TMedia>}.${TEdge}`
  ]: HookPointSpec<'notify', ActivitySessionPayloads[TMedia][TEdge]>
}

export type ActivitySessionPointId = keyof ActivitySessionPointsFor<ActivitySessionEdge>

/**
 * Activity hook points.
 *
 * `activity.game.launching` and `activity.game.play.ending` are waterfall
 * transforms before the launch / persist; every `started` / `ended` edge is a
 * notification. Watch and read points are notify-only: the outcome of a
 * consumption session is a fact, and the subscribers that mirror it to remote
 * services must not alter it.
 */
export type ActivityHookPoints = ActivitySessionPointsFor<'started'> &
  ActivitySessionPointsFor<'ended'> & {
    'activity.game.launching': HookPointSpec<'waterfall', GameLaunchConfig>
    'activity.game.play.ending': HookPointSpec<'waterfall', GamePlayRecord>
  }

/** Runtime ids of every session edge, derived from the media constants. */
export function listActivitySessionPointIds(): ActivitySessionPointId[] {
  const ids: string[] = []
  for (const media of LIBRARY_MEDIA_TYPES) {
    for (const edge of ACTIVITY_SESSION_EDGES) {
      ids.push(`activity.${media}.${ACTIVITY_VERBS[media]}.${edge}`)
    }
  }
  // The template literal type is the only place the id grammar is spelled out;
  // the loop above mirrors it segment for segment.
  return ids as ActivitySessionPointId[]
}

export const ACTIVITY_SESSION_HOOK_KIND: HookKind = 'notify'
