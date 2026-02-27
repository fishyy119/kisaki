/**
 * App updater shared contracts.
 */

export type AppUpdaterStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface AppUpdaterRelease {
  version: string
  releaseName: string | null
  releaseDate: string | null
  releaseNotes: string
}

export interface AppUpdaterDownloadProgress {
  bytesPerSecond: number
  percent: number
  transferred: number
  total: number
}

export interface AppUpdaterState {
  status: AppUpdaterStatus
  update: AppUpdaterRelease | null
  error: string | null
  downloadProgress: AppUpdaterDownloadProgress | null
}
