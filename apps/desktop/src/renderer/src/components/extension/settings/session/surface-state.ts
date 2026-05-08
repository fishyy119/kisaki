import type {
  ExtensionResolvedSettingsDialog,
  ExtensionResolvedSettingsPopover,
  ExtensionResolvedSettingsRoot,
  ExtensionSettingsSurface
} from '@shared/extension'
import { createDraftSnapshot, mergeDraftSnapshot } from './draft'
import type { SettingsSurfaceState, SettingsSurfaceViewMap } from './types'

export function createSurfaceState<TSurface extends ExtensionSettingsSurface>(
  surface: TSurface,
  view: SettingsSurfaceViewMap[TSurface]
): SettingsSurfaceState<TSurface> {
  return {
    surface,
    view,
    draft: createDraftSnapshot(view),
    revision: 1,
    loading: false,
    error: null
  } as SettingsSurfaceState<TSurface>
}

export function mergeSurfaceState(
  previous: SettingsSurfaceState<'root'>,
  view: ExtensionResolvedSettingsRoot
): SettingsSurfaceState<'root'>
export function mergeSurfaceState(
  previous: SettingsSurfaceState<'dialog'>,
  view: ExtensionResolvedSettingsDialog
): SettingsSurfaceState<'dialog'>
export function mergeSurfaceState(
  previous: SettingsSurfaceState<'popover'>,
  view: ExtensionResolvedSettingsPopover
): SettingsSurfaceState<'popover'>
export function mergeSurfaceState(
  previous: SettingsSurfaceState<ExtensionSettingsSurface>,
  view:
    | ExtensionResolvedSettingsRoot
    | ExtensionResolvedSettingsDialog
    | ExtensionResolvedSettingsPopover
): SettingsSurfaceState<ExtensionSettingsSurface> {
  return {
    ...previous,
    view,
    draft: mergeDraftSnapshot(createDraftSnapshot(view), previous.draft),
    revision: previous.revision + 1,
    loading: false,
    error: null
  } as SettingsSurfaceState<ExtensionSettingsSurface>
}

export function getSurfaceKey(surface: SettingsSurfaceState<ExtensionSettingsSurface>): string {
  if (surface.surface === 'root') {
    return 'root'
  }

  if (surface.surface === 'dialog') {
    return `dialog:${surface.view.dialogId}`
  }

  return `${surface.view.parent.surface}:${surface.view.popoverId}`
}
