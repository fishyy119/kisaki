import type { BangumiSettingsRootScope, BangumiSettingsTab } from './contracts'
import { resolveAccountTab } from './account/tab'
import { resolveAdvancedTab } from './advanced/tab'
import { resolveAutomationTab } from './automation/tab'
import { resolveImportTab } from './import/tab'
import { resolveSyncTab } from './sync/tab'

export function resolveSettingsTabs(
  scope: BangumiSettingsRootScope
): Promise<readonly BangumiSettingsTab[]> {
  return Promise.all([
    resolveAccountTab(scope),
    resolveSyncTab(scope),
    resolveImportTab(scope),
    resolveAutomationTab(scope),
    resolveAdvancedTab(scope)
  ])
}
