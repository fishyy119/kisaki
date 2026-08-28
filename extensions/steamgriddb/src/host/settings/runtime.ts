import type { ExtensionLogger } from '@kisaki3/extension-sdk'
import type { SgdbClient } from '../api/client'
import type { SgdbSettingsStore } from '../config/schema'

export interface SgdbSettingsRuntime {
  settingsStore: SgdbSettingsStore
  client: SgdbClient
  logger: ExtensionLogger
  abortSignal: AbortSignal
}
