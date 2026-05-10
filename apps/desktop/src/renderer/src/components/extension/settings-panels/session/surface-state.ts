import type {
  ExtensionResolvedSettingsPanelDialog,
  ExtensionResolvedSettingsPanelPopover,
  ExtensionResolvedSettingsPanelRoot,
  ExtensionSettingsPanelSurface
} from '@shared/extension'
import { createDraftSnapshot, mergeDraftSnapshot } from './draft'
import type { SettingsPanelSurfaceState, SettingsPanelSurfaceViewMap } from './types'

export function createSurfaceState<TSurface extends ExtensionSettingsPanelSurface>(
  surface: TSurface,
  view: SettingsPanelSurfaceViewMap[TSurface]
): SettingsPanelSurfaceState<TSurface> {
  return {
    surface,
    view,
    draft: createDraftSnapshot(view),
    revision: 1,
    loading: false,
    error: null
  } as SettingsPanelSurfaceState<TSurface>
}

export function mergeSurfaceState(
  previous: SettingsPanelSurfaceState<'root'>,
  view: ExtensionResolvedSettingsPanelRoot
): SettingsPanelSurfaceState<'root'>
export function mergeSurfaceState(
  previous: SettingsPanelSurfaceState<'dialog'>,
  view: ExtensionResolvedSettingsPanelDialog
): SettingsPanelSurfaceState<'dialog'>
export function mergeSurfaceState(
  previous: SettingsPanelSurfaceState<'popover'>,
  view: ExtensionResolvedSettingsPanelPopover
): SettingsPanelSurfaceState<'popover'>
export function mergeSurfaceState(
  previous: SettingsPanelSurfaceState<ExtensionSettingsPanelSurface>,
  view:
    | ExtensionResolvedSettingsPanelRoot
    | ExtensionResolvedSettingsPanelDialog
    | ExtensionResolvedSettingsPanelPopover
): SettingsPanelSurfaceState<ExtensionSettingsPanelSurface> {
  return {
    ...previous,
    view,
    draft: mergeDraftSnapshot(createDraftSnapshot(view), previous.draft),
    revision: previous.revision + 1,
    loading: false,
    error: null
  } as SettingsPanelSurfaceState<ExtensionSettingsPanelSurface>
}

export function getSurfaceKey(
  surface: SettingsPanelSurfaceState<ExtensionSettingsPanelSurface>
): string {
  if (surface.surface === 'root') {
    return 'root'
  }

  if (surface.surface === 'dialog') {
    return `dialog:${surface.view.dialogId}`
  }

  return `${surface.view.parent.surface}:${surface.view.popoverId}`
}
