import type { ExtensionLogger, SettingsStore } from '@kisaki3/extension-sdk'
import type { TmdbClient } from '../api/client'
import type { ApiKeyStore } from '../auth/api-key'
import type { TmdbSettingsV1 } from '../config/schema'

export interface TmdbSettingsRuntime {
  settingsStore: SettingsStore<TmdbSettingsV1>
  apiKeys: ApiKeyStore
  client: TmdbClient
  logger: ExtensionLogger
  abortSignal: AbortSignal
}
