import type { ExtensionLogger } from '@kisaki3/extension-sdk'
import type { SettingsStore } from '../utils/settings-store'
import type { IgdbClient } from '../api/client'
import type { CredentialStore } from '../auth/credentials'
import type { IgdbSettingsV1 } from '../config/schema'

export interface IgdbSettingsRuntime {
  settingsStore: SettingsStore<IgdbSettingsV1>
  credentials: CredentialStore
  client: IgdbClient
  logger: ExtensionLogger
  abortSignal: AbortSignal
}
