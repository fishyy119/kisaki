import type { ExtensionLogger, OAuthRelayFlow } from '@kisaki3/extension-sdk'
import type { GbooksClient } from '../api/client'
import type { TokenStore } from '../auth/token-store'
import type { GbooksSettingsStore } from '../config/schema'
import type { GbooksTasks } from '../tasks'

export interface GbooksSettingsRuntime {
  settingsStore: GbooksSettingsStore
  tokenStore: TokenStore
  client: GbooksClient
  oauthFlow: OAuthRelayFlow
  tasks: GbooksTasks
  logger: ExtensionLogger
  abortSignal: AbortSignal
}
