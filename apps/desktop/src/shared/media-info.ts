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

/** A container addressable page by page, as probed. */
export type PagedContainer = 'zip' | 'rar' | 'directory' | 'pdf'

const PAGED_CONTAINERS: readonly PagedContainer[] = ['zip', 'rar', 'directory', 'pdf']

/** Technical facts read from one paged container. */
export interface PagedContainerInfo {
  container: PagedContainer
  /** Readable page count; null when the container probe could not answer. */
  pageCount: number | null
}

/** A container holding one document, told by its extension. */
export type DocumentContainer = 'epub' | 'mobi' | 'azw3' | 'fb2' | 'txt' | 'pdf'

const DOCUMENT_CONTAINERS: readonly DocumentContainer[] = [
  'epub',
  'mobi',
  'azw3',
  'fb2',
  'txt',
  'pdf'
]

/**
 * Reads a stored container value back into its union.
 *
 * Probes write these columns, so a value can predate the current vocabulary;
 * an unrecognized one degrades to null and the caller treats the file as a
 * plain container rather than refusing to open it.
 */
export function parsePagedContainer(value: string | null): PagedContainer | null {
  return (PAGED_CONTAINERS as readonly string[]).includes(value ?? '')
    ? (value as PagedContainer)
    : null
}

/** Reads a stored document container value back into its union; see above. */
export function parseDocumentContainer(value: string | null): DocumentContainer | null {
  return (DOCUMENT_CONTAINERS as readonly string[]).includes(value ?? '')
    ? (value as DocumentContainer)
    : null
}
