import type { ExtensionLogger } from '@kisaki3/extension-sdk'
import type { IgdbClient } from '../api/client'
import type { CredentialStore } from '../auth/credentials'
import type { SettingsStore } from '../config/store'

export interface IgdbSettingsRuntime {
  settingsStore: SettingsStore
  credentials: CredentialStore
  client: IgdbClient
  logger: ExtensionLogger
  abortSignal: AbortSignal
}
