export type RuntimeMode = 'development' | 'production'

export type RuntimePlatform = 'windows' | 'macos' | 'linux'

export interface RuntimeInfo {
  appVersion: string
  apiVersion: string
  mode: RuntimeMode
  platform: RuntimePlatform
  arch: string
}

export interface RuntimeCapability {
  getInfo(): Promise<RuntimeInfo>
  delay(ms: number): Promise<void>
  openExternal(url: string): Promise<void>
}
