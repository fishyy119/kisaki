import type { ExtensionLogger } from '@kisaki3/extension-sdk'
import type { NeodbClient } from '../api/client'
import type { NeodbOauthFlow } from '../auth/oauth-flow'
import type { SessionStore } from '../auth/session-store'
import type { NeodbSettingsStore } from '../config/schema'
import type { NeodbTasks } from '../tasks'

export interface NeodbSettingsRuntime {
  settingsStore: NeodbSettingsStore
  sessionStore: SessionStore
  client: NeodbClient
  oauthFlow: NeodbOauthFlow
  tasks: NeodbTasks
  logger: ExtensionLogger
  abortSignal: AbortSignal
}
