import type { UiLocale } from '../shared/locales'

export type RuntimeMode = 'development' | 'production'

export type RuntimePlatform = 'windows' | 'macos' | 'linux'

export interface RuntimeInfo {
  appVersion: string
  apiVersion: string
  mode: RuntimeMode
  platform: RuntimePlatform
  arch: string
  /** Host interface language at snapshot time; `runtime.uiLocale` stays current. */
  uiLocale: UiLocale
}

export interface RuntimeCapability {
  /**
   * Host interface language currently in effect. The platform keeps this
   * current, so catalog lookups read it directly; `app.ui-locale.changed`
   * remains available for reactions beyond message lookup.
   */
  readonly uiLocale: UiLocale
  getInfo(): Promise<RuntimeInfo>
  delay(ms: number): Promise<void>
  openExternal(url: string): Promise<void>
}
