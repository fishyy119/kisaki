import type { ExtensionLogger } from '@kisaki3/extension-sdk'
import type { MalMirrorClient } from '../api/mirror-client'
import type { MalOfficialClient } from '../api/official-client'
import type { MalSettingsV1 } from '../config/schema'

/** What every MAL scraper provider is built on: both clients and live settings. */
export interface MalRuntime {
  readonly official: MalOfficialClient
  readonly mirror: MalMirrorClient
  readonly logger: ExtensionLogger
  getSettings(): Promise<MalSettingsV1>
}
