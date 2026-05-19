import type {
  CommandExecutionResult,
  EmptySettingsPanelPopoverMap,
  SerializableRecord,
  SettingsPanelDialogDefinition,
  SettingsPanelDialogNodeEvents,
  SettingsPanelDialogSubmitEvent,
  SettingsPanelDialogSubmitResult,
  SettingsPanelField,
  SettingsPanelNodeFactory,
  SettingsPanelRootNodeEvents
} from '@kisaki/extension-sdk'

export type BangumiSettingsDialogId = 'fullSync' | 'importMyCollections' | 'importIndex'
export type BangumiSettingsDialogMap = Record<
  BangumiSettingsDialogId,
  SettingsPanelDialogDefinition<SerializableRecord, EmptySettingsPanelPopoverMap>
>
export type BangumiSettingsRootEvents = SettingsPanelRootNodeEvents<
  EmptySettingsPanelPopoverMap,
  BangumiSettingsDialogMap
>
export type BangumiSettingsDialogEvents = SettingsPanelDialogNodeEvents<
  SerializableRecord,
  EmptySettingsPanelPopoverMap
>
export type BangumiSettingsRootFactory = SettingsPanelNodeFactory<BangumiSettingsRootEvents>
export type BangumiSettingsDialogFactory = SettingsPanelNodeFactory<BangumiSettingsDialogEvents>
export type BangumiSettingsRootField = SettingsPanelField<BangumiSettingsRootEvents>
export type BangumiSettingsDialogField = SettingsPanelField<BangumiSettingsDialogEvents>
export type BangumiSettingsRootButtonEvent = BangumiSettingsRootEvents['buttonEvent']
export type BangumiSettingsRootButtonResult = BangumiSettingsRootEvents['buttonResult']
export type BangumiSettingsDialogButtonEvent = BangumiSettingsDialogEvents['buttonEvent']
export type BangumiSettingsDialogButtonResult = BangumiSettingsDialogEvents['buttonResult']
export type BangumiSettingsDialogSubmitEvent = SettingsPanelDialogSubmitEvent<SerializableRecord>
export type BangumiSettingsDialogSubmitResult = SettingsPanelDialogSubmitResult

export type BangumiPreviewKey = 'sync.full' | 'import.myCollections' | 'import.index'

export interface ResolvedPreviewResult {
  args: SerializableRecord
  result: CommandExecutionResult
}

export interface BangumiPreviewLink extends SerializableRecord {
  label: string
  href: string
}

export interface BangumiPreviewChange extends SerializableRecord {
  game: string
  bangumi: BangumiPreviewLink
  action: string
  local: string
  remote: string
}
