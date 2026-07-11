/**
 * App updater shared contracts.
 */

export type AppUpdaterStatus =
  'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'

export interface AppUpdaterRelease {
  version: string
  releaseName: string | null
  releaseDate: string | null
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

export type AppUpdaterChangelogLocale = 'zh-Hans' | 'en' | 'ja'

export const APP_UPDATER_CHANGELOG_LOCALES: AppUpdaterChangelogLocale[] = ['zh-Hans', 'en', 'ja']

export const DEFAULT_APP_UPDATER_CHANGELOG_LOCALE: AppUpdaterChangelogLocale = 'zh-Hans'

export interface AppUpdaterChangelogBundle {
  version: string
  markdownByLocale: Record<AppUpdaterChangelogLocale, string | null>
}
