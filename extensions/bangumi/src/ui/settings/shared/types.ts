import type {
  CommandInvocationResult,
  EmptySettingsPanelPopoverMap,
  JsonObject,
  SettingsPanelDialogButtonClickEvent,
  SettingsPanelDialogButtonResult,
  SettingsPanelDialogSubmitEvent,
  SettingsPanelDialogSubmitResult
} from '@kisaki3/extension-sdk'

export type BangumiSettingsPopovers = EmptySettingsPanelPopoverMap

export type BangumiSettingsDialogButtonEvent<TParams extends JsonObject = JsonObject> =
  SettingsPanelDialogButtonClickEvent<TParams, BangumiSettingsPopovers>
export type BangumiSettingsDialogButtonResult =
  SettingsPanelDialogButtonResult<BangumiSettingsPopovers>
export type BangumiSettingsDialogSubmitEvent<TParams extends JsonObject = JsonObject> =
  SettingsPanelDialogSubmitEvent<TParams>
export type BangumiSettingsDialogSubmitResult = SettingsPanelDialogSubmitResult

export type BangumiPreviewKey = 'sync.full' | 'import.myCollections' | 'import.index'

export type ResolvedPreviewResult = CompletedPreviewResult

export interface CompletedPreviewResult {
  state: 'completed'
  args: JsonObject
  result: CommandInvocationResult
}

export interface BangumiPreviewLink extends JsonObject {
  label: string
  href: string
}

export type BangumiPreviewTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export interface BangumiPreviewBadge extends JsonObject {
  label: string
  tone: BangumiPreviewTone
}

export interface BangumiPreviewRow extends JsonObject {
  label: string
  before: string
  after: string
  tone: BangumiPreviewTone
}

export interface BangumiPreviewGroup extends JsonObject {
  id: string
  title: string
  link: BangumiPreviewLink
  badges: readonly BangumiPreviewBadge[]
  rows: readonly BangumiPreviewRow[]
}
