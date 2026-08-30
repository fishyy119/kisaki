import type { ExtensionLogger } from '@kisaki3/extension-sdk'
import type { SettingsStore } from '../utils/settings-store'
import type { YmgalClient } from '../api/client'
import type { CredentialStore } from '../auth/credentials'
import type { YmgalSettingsV1 } from '../config/schema'

export interface YmgalSettingsRuntime {
  settingsStore: SettingsStore<YmgalSettingsV1>
  credentials: CredentialStore
  client: YmgalClient
  logger: ExtensionLogger
  abortSignal: AbortSignal
}
