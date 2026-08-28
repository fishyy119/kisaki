import type { ExtensionLogger } from '@kisaki3/extension-sdk'
import type { VndbClient } from '../api/client'
import type { TokenStore } from '../auth/token'
import type { VndbSettingsStore } from '../config/schema'
import type { VndbTasks } from '../tasks'

export interface VndbSettingsRuntime {
  settingsStore: VndbSettingsStore
  tokens: TokenStore
  client: VndbClient
  tasks: VndbTasks
  logger: ExtensionLogger
  abortSignal: AbortSignal
}
