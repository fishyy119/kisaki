import type {
  CommandInvocationResult,
  EmptySettingsPanelPopoverMap,
  SerializableRecord,
  SettingsPanelDialogButtonClickEvent,
  SettingsPanelDialogButtonResult,
  SettingsPanelDialogSubmitEvent,
  SettingsPanelDialogSubmitResult
} from '@kisaki3/extension-sdk'

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

export type ResolvedPreviewResult = CompletedPreviewResult

export interface CompletedPreviewResult {
  state: 'completed'
  args: SerializableRecord
  result: CommandInvocationResult
}

export interface BangumiPreviewLink extends SerializableRecord {
  label: string
  href: string
}

export type BangumiPreviewTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export interface BangumiPreviewBadge extends SerializableRecord {
  label: string
  tone: BangumiPreviewTone
}

export interface BangumiPreviewRow extends SerializableRecord {
  label: string
  before: string
  after: string
  tone: BangumiPreviewTone
}

export interface BangumiPreviewGroup extends SerializableRecord {
  id: string
  title: string
  link: BangumiPreviewLink
  badges: readonly BangumiPreviewBadge[]
  rows: readonly BangumiPreviewRow[]
}
