import type {
  ExtensionLogger,
  LibraryCapability,
  ExtensionTaskRunsCapability,
  FilesCapability,
  NotifyCapability,
  ScrapersCapability
} from '@kisaki3/extension-sdk'
import type { VniteImporterSettingsStore } from '../../config'
import type { VniteImportJobRunner } from '../../jobs'
import type { VniteImportFlowStore } from './flow'

export interface VniteSettingsRuntime {
  settingsStore: VniteImporterSettingsStore
  flowStore: VniteImportFlowStore
  jobRunner: VniteImportJobRunner
  library: LibraryCapability
  files: FilesCapability
  notify: NotifyCapability
  scrapers: ScrapersCapability
  taskRuns: ExtensionTaskRunsCapability
  logger: ExtensionLogger
  abortSignal: AbortSignal
}

export function createVniteSettingsRuntime(
  dependencies: VniteSettingsRuntime
): VniteSettingsRuntime {
  return dependencies
}
