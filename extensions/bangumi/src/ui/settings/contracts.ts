import type {
  SettingsPanelField,
  SettingsPanelNodeFactory,
  SettingsPanelRootNodeEvents,
  SettingsPanelRootResolveContext,
  SettingsPanelTab
} from '@kisaki3/extension-sdk'
import type { BangumiSettingsDialogs } from './dialogs'
import type { BangumiSettingsResources } from './resources'
import type { BangumiSettingsRuntime } from './runtime'
import type { BangumiSettingsPopovers } from './shared/types'

export type BangumiSettingsRootEvents = SettingsPanelRootNodeEvents<
  BangumiSettingsPopovers,
  BangumiSettingsDialogs
>
export type BangumiSettingsRootFactory = SettingsPanelNodeFactory<BangumiSettingsRootEvents>
export type BangumiSettingsRootField = SettingsPanelField<BangumiSettingsRootEvents>
export type BangumiSettingsTab = SettingsPanelTab<BangumiSettingsRootEvents>
export type BangumiSettingsRootButtonEvent = BangumiSettingsRootEvents['buttonEvent']
export type BangumiSettingsRootButtonResult = BangumiSettingsRootEvents['buttonResult']

export interface BangumiSettingsRootScope {
  context: SettingsPanelRootResolveContext
  ui: BangumiSettingsRootFactory
  runtime: BangumiSettingsRuntime
  resources: BangumiSettingsResources
}
