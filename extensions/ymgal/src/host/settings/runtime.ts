import type { ExtensionLogger } from '@kisaki3/extension-sdk'
import type { YmgalClient } from '../api/client'
import type { CredentialStore } from '../auth/credentials'
import type { SettingsStore } from '../config/store'

export interface YmgalSettingsRuntime {
  settingsStore: SettingsStore
  credentials: CredentialStore
  client: YmgalClient
  logger: ExtensionLogger
  abortSignal: AbortSignal
}
