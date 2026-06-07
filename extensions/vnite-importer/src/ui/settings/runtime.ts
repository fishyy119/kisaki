import type {
  ExtensionLogger,
  ExtensionTaskRunsCapability,
  FilesCapability,
  ScrapersCapability
} from '@kisaki3/extension-sdk'
import type { VniteImporterSettingsStore } from '../../config'
import type { VniteImportJobRunner } from '../../jobs'
import type { VniteImportFlowStore } from './flow'

export interface VniteSettingsPanelDependencies {
  settingsStore: VniteImporterSettingsStore
  flowStore: VniteImportFlowStore
  jobRunner: VniteImportJobRunner
  files: FilesCapability
  scrapers: ScrapersCapability
  taskRuns: ExtensionTaskRunsCapability
  logger: ExtensionLogger
  abortSignal: AbortSignal
}

export interface VniteSettingsRuntime extends VniteSettingsPanelDependencies {}

export function createVniteSettingsRuntime(
  dependencies: VniteSettingsPanelDependencies
): VniteSettingsRuntime {
  return dependencies
}
