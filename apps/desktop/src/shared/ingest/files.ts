/**
 * Local media file sync contracts.
 *
 * Reconciling an entry's on-disk media with its rows is a user-visible action,
 * so its request and report shapes cross the process boundary.
 */

export interface IngestSyncAnimeFilesParams {
  animeId: string
  /** Defaults to the anime's stored library directory. */
  dirPath?: string
}

export interface IngestSyncAnimeFilesResult {
  episodeCount: number
  fileCount: number
  extraCount: number
  /** Files whose episode number could not be read from the file name. */
  unrecognizedFiles: string[]
}
