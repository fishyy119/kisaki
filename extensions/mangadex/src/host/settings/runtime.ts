import type { ExtensionLogger } from '@kisaki3/extension-sdk'
import type { MangadexClient } from '../api/client'
import type { CredentialsStore } from '../auth/credentials-store'
import type { TokenManager } from '../auth/token-manager'
import type { MangadexSettingsStore } from '../config/schema'
import type { MangadexTasks } from '../tasks'

export interface MangadexSettingsRuntime {
  settingsStore: MangadexSettingsStore
  credentialsStore: CredentialsStore
  tokenManager: TokenManager
  client: MangadexClient
  tasks: MangadexTasks
  logger: ExtensionLogger
  abortSignal: AbortSignal
}
