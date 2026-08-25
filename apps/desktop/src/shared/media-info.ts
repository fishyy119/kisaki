/**
 * Shared media file probe contracts.
 *
 * Technical facts read from a media container. Domain-agnostic: nothing here
 * knows which media type owns the file.
 */

export interface MediaAudioTrack {
  index: number
  codec: string | null
  language: string | null
  title: string | null
  channels: number | null
  isDefault: boolean
}

export interface MediaSubtitleTrack {
  index: number
  codec: string | null
  language: string | null
  title: string | null
  isDefault: boolean
  isForced: boolean
}

export interface MediaVideoTrack {
  index: number
  codec: string | null
  /** Bits per raw sample; 10 marks the Hi10P/HDR-capable encodes. */
  bitDepth: number | null
  width: number | null
  height: number | null
  frameRate: number | null
}

export interface MediaFileInfo {
  durationMs: number | null
  container: string | null
  video: MediaVideoTrack | null
  audioTracks: readonly MediaAudioTrack[]
  subtitleTracks: readonly MediaSubtitleTrack[]
}

/** Container kind of one comic unit file, as probed. */
export type ComicUnitContainer = 'zip' | 'rar' | 'directory' | 'pdf'

/** Technical facts read from one comic unit file. */
export interface ComicUnitFileInfo {
  container: ComicUnitContainer
  /** Readable page count; null when the container hides it (PDF probe failure). */
  pageCount: number | null
}

/** Container kind of one novel volume file, told by its extension. */
export type NovelFileContainer = 'epub' | 'mobi' | 'azw3' | 'fb2' | 'txt' | 'pdf'
