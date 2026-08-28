import type { ExtensionLogger } from '@kisaki3/extension-sdk'
import type { MalOfficialClient } from '../api/official-client'
import type { MalOauthFlow } from '../auth/oauth-flow'
import type { TokenStore } from '../auth/token-store'
import type { MalSettingsStore } from '../config/schema'
import type { MalTasks } from '../tasks'

export interface MalSettingsRuntime {
  settingsStore: MalSettingsStore
  tokenStore: TokenStore
  client: MalOfficialClient
  oauthFlow: MalOauthFlow
  tasks: MalTasks
  logger: ExtensionLogger
  abortSignal: AbortSignal
}
