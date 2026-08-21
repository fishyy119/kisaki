/**
 * Local media file sync contracts.
 *
 * Reconciling an entry's on-disk media with its rows is a user-visible action,
 * so its request and report shapes cross the process boundary.
 */

import type { AnimeExtraType } from '../db/contracts/enums'

export interface IngestSyncAnimeFilesParams {
  animeId: string
  /** Defaults to the anime's stored library directory. */
  dirPath?: string
}

export interface IngestSyncAnimeFilesResult {
  episodeCount: number
  fileCount: number
  /** Extra rows after the sync pass. */
  extraCount: number
  /** Files whose episode number could not be read from the file name. */
  unrecognizedFiles: string[]
}

/** Attach one on-disk video file to an episode as a user-owned file row. */
export interface IngestAttachAnimeEpisodeFileParams {
  episodeId: string
  /** Absolute path; may live outside the anime's library directory. */
  path: string
}

/** Register one on-disk video file as a user-owned extra file row. */
export interface IngestAttachAnimeExtraFileParams {
  animeId: string
  /** Absolute path; may live outside the anime's library directory. */
  path: string
  /** Attach the file to this existing extra; a new extra is created when omitted. */
  extraId?: string
  /** Explicit display name; filename recognition names a new extra when omitted. */
  name?: string
  /** Explicit type; filename recognition guesses a new extra's type when omitted. */
  type?: AnimeExtraType
}
