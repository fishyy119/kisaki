/**
 * Video engine contracts.
 *
 * Two halves of one technical layer: playback sessions and the container facts
 * read from the same files. Both are domain-agnostic — a playback target is a
 * file plus session placement, and every expected outcome travels as data so
 * callers never inspect error text. These reasons are technical, so the
 * business layer that started the playback maps them onto its own user-facing
 * outcome before anything is rendered.
 */

// =============================================================================
// Playback
// =============================================================================

/** Playback engine lifecycle state for one session. */
export type PlaybackStatus = 'loading' | 'playing' | 'paused' | 'ended'

/** Why a playback session stopped. */
export type PlaybackEndReason = 'completed' | 'stopped' | 'closed' | 'error'

export type PlaybackStartFailureReason =
  'engineNotFound' | 'fileNotFound' | 'engineStartFailed' | 'engineNotResponding'

export interface PlaybackTarget {
  /** Absolute path of the media file to play. */
  path: string
  /** Window/OSD title shown by the engine. */
  title?: string
  /** Resume position in milliseconds. */
  startPositionMs?: number
}

/** Live position report for an active session. */
export interface PlaybackProgress {
  sessionId: string
  positionMs: number
  durationMs: number | null
}

export interface PlaybackSessionState {
  sessionId: string
  path: string
  status: PlaybackStatus
  positionMs: number
  durationMs: number | null
}

export type PlaybackStartResult =
  | { status: 'started'; sessionId: string }
  | { status: 'failed'; reason: PlaybackStartFailureReason }

/** Final report emitted once a session leaves the engine. */
export interface PlaybackEndReport {
  sessionId: string
  path: string
  reason: PlaybackEndReason
  positionMs: number
  durationMs: number | null
  /** Wall-clock milliseconds the session stayed open. */
  elapsedMs: number
}

// =============================================================================
// Container facts
// =============================================================================

export interface AudioTrack {
  index: number
  codec: string | null
  language: string | null
  title: string | null
  channels: number | null
  isDefault: boolean
}

export interface SubtitleTrack {
  index: number
  codec: string | null
  language: string | null
  title: string | null
  isDefault: boolean
  isForced: boolean
}

export interface VideoTrack {
  index: number
  codec: string | null
  /** Bits per raw sample; 10 marks the Hi10P/HDR-capable encodes. */
  bitDepth: number | null
  width: number | null
  height: number | null
  frameRate: number | null
}

/** Technical facts read from one playable container. */
export interface VideoFileInfo {
  durationMs: number | null
  container: string | null
  video: VideoTrack | null
  audioTracks: readonly AudioTrack[]
  subtitleTracks: readonly SubtitleTrack[]
}
