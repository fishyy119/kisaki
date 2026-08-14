import type { ExtensionLogger } from '@kisaki3/extension-sdk'
import type { TmdbClient } from '../api/client'
import type { ApiKeyStore } from '../auth/api-key'
import type { SettingsStore } from '../config/store'

export interface TmdbSettingsRuntime {
  settingsStore: SettingsStore
  apiKeys: ApiKeyStore
  client: TmdbClient
  logger: ExtensionLogger
  abortSignal: AbortSignal
}
