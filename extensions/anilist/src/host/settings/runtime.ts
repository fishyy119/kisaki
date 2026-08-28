import type { ExtensionLogger, OAuthRelayFlow } from '@kisaki3/extension-sdk'
import type { AnilistClient } from '../api/client'
import type { TokenStore } from '../auth/token-store'
import type { AnilistSettingsStore } from '../config/schema'
import type { AnilistTasks } from '../tasks'

export interface AnilistSettingsRuntime {
  settingsStore: AnilistSettingsStore
  tokenStore: TokenStore
  client: AnilistClient
  oauthFlow: OAuthRelayFlow
  tasks: AnilistTasks
  logger: ExtensionLogger
  abortSignal: AbortSignal
}
