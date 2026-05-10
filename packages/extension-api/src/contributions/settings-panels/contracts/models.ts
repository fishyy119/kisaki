import type { SerializableRecord } from '../../../shared'
import type {
  EmptySettingsPanelDialogMap,
  EmptySettingsPanelPopoverMap,
  SettingsPanelDialogMap,
  SettingsPanelPopoverMap
} from './definitions'
import type {
  SettingsPanelDialogNodeEvents,
  SettingsPanelPopoverNodeEvents,
  SettingsPanelRootNodeEvents
} from './events'
import type { SettingsPanelField, SettingsPanelTab } from './nodes'
import type { SettingsPanelDialogSize, SettingsPanelPopoverWidth } from './shared'

export type SettingsPanelRootModel<
  TPopovers extends SettingsPanelPopoverMap = EmptySettingsPanelPopoverMap,
  TDialogs extends SettingsPanelDialogMap<TPopovers> = EmptySettingsPanelDialogMap
> = SettingsPanelRootModelBase &
  (
    | {
        fields: readonly SettingsPanelField<SettingsPanelRootNodeEvents<TPopovers, TDialogs>>[]
        tabs?: never
        activeTabId?: never
      }
    | {
        tabs: readonly SettingsPanelTab<SettingsPanelRootNodeEvents<TPopovers, TDialogs>>[]
        activeTabId?: string
        fields?: never
      }
  )

export interface SettingsPanelRootModelBase {
  title?: string
  description?: string
  size?: SettingsPanelDialogSize
}

export interface SettingsPanelDialogModel<
  TParams extends SerializableRecord = SerializableRecord,
  TPopovers extends SettingsPanelPopoverMap = EmptySettingsPanelPopoverMap
> {
  title?: string
  description?: string
  size?: SettingsPanelDialogSize
  fields: readonly SettingsPanelField<SettingsPanelDialogNodeEvents<TParams, TPopovers>>[]
}

export interface SettingsPanelPopoverModel<
  TParams extends SerializableRecord = SerializableRecord
> {
  title?: string
  description?: string
  width?: SettingsPanelPopoverWidth
  fields: readonly SettingsPanelField<SettingsPanelPopoverNodeEvents<TParams>>[]
}
