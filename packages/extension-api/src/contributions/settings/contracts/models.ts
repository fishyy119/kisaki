import type { SerializableRecord } from '../../../shared'
import type {
  EmptySettingsDialogMap,
  EmptySettingsPopoverMap,
  SettingsDialogMap,
  SettingsPopoverMap
} from './definitions'
import type {
  SettingsDialogNodeEvents,
  SettingsPopoverNodeEvents,
  SettingsRootNodeEvents
} from './events'
import type { SettingsField, SettingsTab } from './nodes'
import type { SettingsDialogSize, SettingsPopoverWidth } from './shared'

export type SettingsRootModel<
  TPopovers extends SettingsPopoverMap = EmptySettingsPopoverMap,
  TDialogs extends SettingsDialogMap<TPopovers> = EmptySettingsDialogMap
> = SettingsRootModelBase &
  (
    | {
        fields: readonly SettingsField<SettingsRootNodeEvents<TPopovers, TDialogs>>[]
        tabs?: never
        activeTabId?: never
      }
    | {
        tabs: readonly SettingsTab<SettingsRootNodeEvents<TPopovers, TDialogs>>[]
        activeTabId?: string
        fields?: never
      }
  )

export interface SettingsRootModelBase {
  title?: string
  description?: string
  size?: SettingsDialogSize
}

export interface SettingsDialogModel<
  TParams extends SerializableRecord = SerializableRecord,
  TPopovers extends SettingsPopoverMap = EmptySettingsPopoverMap
> {
  title?: string
  description?: string
  size?: SettingsDialogSize
  fields: readonly SettingsField<SettingsDialogNodeEvents<TParams, TPopovers>>[]
}

export interface SettingsPopoverModel<TParams extends SerializableRecord = SerializableRecord> {
  title?: string
  description?: string
  width?: SettingsPopoverWidth
  fields: readonly SettingsField<SettingsPopoverNodeEvents<TParams>>[]
}
