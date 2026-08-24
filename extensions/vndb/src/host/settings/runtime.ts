import type { ExtensionLogger } from '@kisaki3/extension-sdk'
import type { VndbClient } from '../api/client'
import type { TokenStore } from '../auth/token'
import type { SettingsStore } from '../config/store'

export interface VndbSettingsRuntime {
  settingsStore: SettingsStore
  tokens: TokenStore
  client: VndbClient
  logger: ExtensionLogger
  abortSignal: AbortSignal
}
