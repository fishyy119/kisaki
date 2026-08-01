import type { AutomationsCapability } from './capabilities/automations'
import type { CommandsCapability } from './capabilities/commands'
import type { FilesCapability } from './capabilities/files'
import type { IngestCapability } from './capabilities/ingest'
import type { LibraryCapability } from './capabilities/library'
import type { NetworkCapability } from './capabilities/network'
import type { NotifyCapability } from './capabilities/notify'
import type { RuntimeCapability } from './capabilities/runtime'
import type { ScrapersCapability } from './capabilities/scrapers'
import type { TaskRunsCapability } from './capabilities/task-runs'
import type { WebviewsCapability } from './capabilities/webviews'

export interface KisakiApi {
  readonly files: FilesCapability
  readonly library: LibraryCapability
  readonly network: NetworkCapability
  readonly notify: NotifyCapability
  readonly runtime: RuntimeCapability
  readonly scrapers: ScrapersCapability
  readonly ingest: IngestCapability
  readonly commands: CommandsCapability
  readonly automations: AutomationsCapability
  readonly taskRuns: TaskRunsCapability
  readonly webviews: WebviewsCapability
}
