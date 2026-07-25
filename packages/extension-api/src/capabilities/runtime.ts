import type { UiLocale } from '../shared/locales'

export type RuntimeMode = 'development' | 'production'

export type RuntimePlatform = 'windows' | 'macos' | 'linux'

export interface RuntimeInfo {
  appVersion: string
  apiVersion: string
  mode: RuntimeMode
  platform: RuntimePlatform
  arch: string
  /** Host interface language in effect. Follow `app.ui-locale.changed` for updates. */
  uiLocale: UiLocale
}

export interface RuntimeCapability {
  getInfo(): Promise<RuntimeInfo>
  delay(ms: number): Promise<void>
  openExternal(url: string): Promise<void>
}
