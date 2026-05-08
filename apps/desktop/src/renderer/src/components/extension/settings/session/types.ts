import type { ComputedRef, Ref } from 'vue'
import type { SerializableValue } from '@kisaki/extension-api'
import type {
  ExtensionResolvedSettingsDialog,
  ExtensionResolvedSettingsNode,
  ExtensionResolvedSettingsPopover,
  ExtensionResolvedSettingsRoot,
  ExtensionSettingsDraftSnapshot,
  ExtensionSettingsParentRef,
  ExtensionSettingsSession,
  ExtensionSettingsSurface
} from '@shared/extension'

export type SettingsSurfaceViewMap = {
  root: ExtensionResolvedSettingsRoot
  dialog: ExtensionResolvedSettingsDialog
  popover: ExtensionResolvedSettingsPopover
}

interface SettingsSurfaceStateBase<
  TSurface extends ExtensionSettingsSurface,
  TView extends SettingsSurfaceViewMap[TSurface]
> {
  surface: TSurface
  view: TView
  draft: ExtensionSettingsDraftSnapshot
  revision: number
  loading: boolean
  error: string | null
}

export type SettingsSurfaceState<TSurface extends ExtensionSettingsSurface> =
  TSurface extends 'root'
    ? SettingsSurfaceStateBase<'root', ExtensionResolvedSettingsRoot>
    : TSurface extends 'dialog'
      ? SettingsSurfaceStateBase<'dialog', ExtensionResolvedSettingsDialog>
      : SettingsSurfaceStateBase<'popover', ExtensionResolvedSettingsPopover>

export interface SettingsInvokeSource<TSurface extends ExtensionSettingsSurface> {
  surface: SettingsSurfaceState<TSurface>
  fieldId: string
  node: ExtensionResolvedSettingsNode
  value?: SerializableValue
}

export interface ExtensionSettingsSessionController {
  session: Ref<ExtensionSettingsSession | null>
  root: Ref<SettingsSurfaceState<'root'> | null>
  activeDialog: Ref<SettingsSurfaceState<'dialog'> | null>
  activeRootPopover: Ref<SettingsSurfaceState<'popover'> | null>
  activeDialogPopover: Ref<SettingsSurfaceState<'popover'> | null>
  opening: Ref<boolean>
  busy: ComputedRef<boolean>
  error: Ref<string | null>
  openRoot: () => Promise<void>
  closeRoot: () => void
  closeDialog: () => Promise<void>
  closePopover: (parent: ExtensionSettingsParentRef) => Promise<void>
  retry: () => Promise<void>
  updateValue: (
    surface: SettingsSurfaceState<ExtensionSettingsSurface>,
    nodeId: string,
    value: SerializableValue
  ) => void
  invokeNode: (source: SettingsInvokeSource<ExtensionSettingsSurface>) => Promise<void>
  submit: (surface: SettingsSurfaceState<'root' | 'dialog'>) => Promise<void>
  isCallbackBusy: (callbackId?: string) => boolean
  getNodeKey: (
    surface: SettingsSurfaceState<ExtensionSettingsSurface>,
    fieldId: string,
    nodeId: string
  ) => string
}
