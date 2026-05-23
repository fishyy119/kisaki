import type { ComputedRef, Ref } from 'vue'
import type { SerializableValue } from '@kisaki3/extension-api'
import type {
  ExtensionResolvedSettingsPanelDialog,
  ExtensionResolvedSettingsPanelNode,
  ExtensionResolvedSettingsPanelPopover,
  ExtensionResolvedSettingsPanelRoot,
  ExtensionSettingsPanelDraftSnapshot,
  ExtensionSettingsPanelParentRef,
  ExtensionSettingsPanelSession,
  ExtensionSettingsPanelSurface
} from '@shared/extension'

export type SettingsPanelSurfaceViewMap = {
  root: ExtensionResolvedSettingsPanelRoot
  dialog: ExtensionResolvedSettingsPanelDialog
  popover: ExtensionResolvedSettingsPanelPopover
}

interface SettingsPanelSurfaceStateBase<
  TSurface extends ExtensionSettingsPanelSurface,
  TView extends SettingsPanelSurfaceViewMap[TSurface]
> {
  surface: TSurface
  view: TView
  draft: ExtensionSettingsPanelDraftSnapshot
  revision: number
  loading: boolean
  error: string | null
}

export type SettingsPanelSurfaceState<TSurface extends ExtensionSettingsPanelSurface> =
  TSurface extends 'root'
    ? SettingsPanelSurfaceStateBase<'root', ExtensionResolvedSettingsPanelRoot>
    : TSurface extends 'dialog'
      ? SettingsPanelSurfaceStateBase<'dialog', ExtensionResolvedSettingsPanelDialog>
      : SettingsPanelSurfaceStateBase<'popover', ExtensionResolvedSettingsPanelPopover>

export interface SettingsPanelInvokeSource<TSurface extends ExtensionSettingsPanelSurface> {
  surface: SettingsPanelSurfaceState<TSurface>
  fieldId: string
  node: ExtensionResolvedSettingsPanelNode
  value?: SerializableValue
}

export interface ExtensionSettingsPanelSessionController {
  session: Ref<ExtensionSettingsPanelSession | null>
  root: Ref<SettingsPanelSurfaceState<'root'> | null>
  activeDialog: Ref<SettingsPanelSurfaceState<'dialog'> | null>
  activeRootPopover: Ref<SettingsPanelSurfaceState<'popover'> | null>
  activeDialogPopover: Ref<SettingsPanelSurfaceState<'popover'> | null>
  opening: Ref<boolean>
  busy: ComputedRef<boolean>
  error: Ref<string | null>
  openRoot: () => Promise<void>
  closeRoot: () => void
  closeDialog: () => Promise<void>
  closePopover: (parent: ExtensionSettingsPanelParentRef) => Promise<void>
  retry: () => Promise<void>
  updateValue: (
    surface: SettingsPanelSurfaceState<ExtensionSettingsPanelSurface>,
    nodeId: string,
    value: SerializableValue
  ) => void
  invokeNode: (source: SettingsPanelInvokeSource<ExtensionSettingsPanelSurface>) => Promise<void>
  submit: (surface: SettingsPanelSurfaceState<'root' | 'dialog'>) => Promise<void>
  isCallbackBusy: (callbackId?: string) => boolean
  getNodeKey: (
    surface: SettingsPanelSurfaceState<ExtensionSettingsPanelSurface>,
    fieldId: string,
    nodeId: string
  ) => string
}
