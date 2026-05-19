import type {
  CommandExecutionResult,
  EmptySettingsPanelPopoverMap,
  SerializableRecord,
  SettingsPanelDialogButtonClickEvent,
  SettingsPanelDialogButtonResult,
  SettingsPanelDialogSubmitEvent,
  SettingsPanelDialogSubmitResult
} from '@kisaki/extension-sdk'

export type BangumiSettingsPopovers = EmptySettingsPanelPopoverMap

export type BangumiSettingsDialogButtonEvent<
  TParams extends SerializableRecord = SerializableRecord
> = SettingsPanelDialogButtonClickEvent<TParams, BangumiSettingsPopovers>
export type BangumiSettingsDialogButtonResult =
  SettingsPanelDialogButtonResult<BangumiSettingsPopovers>
export type BangumiSettingsDialogSubmitEvent<
  TParams extends SerializableRecord = SerializableRecord
> = SettingsPanelDialogSubmitEvent<TParams>
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
