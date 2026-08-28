import type { ExtensionLogger } from '@kisaki3/extension-sdk'
import type { SteamClient } from '../api/client'
import type { SteamSettingsStore } from '../config/schema'
import type { SteamTasks } from '../tasks'

export interface SteamSettingsRuntime {
  settingsStore: SteamSettingsStore
  client: SteamClient
  tasks: SteamTasks
  logger: ExtensionLogger
  abortSignal: AbortSignal
}
