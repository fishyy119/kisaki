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
