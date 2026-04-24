import { ipcManager } from '@renderer/core/ipc'
import type { EntityMenuResolveInput } from '@kisaki/extension-api'
import type {
  ExtensionCatalogInfo,
  ExtensionContributionSnapshot,
  ExtensionEntityMenuInvokeRequest,
  ExtensionEntityMenuInvokeResult,
  ExtensionResolvedEntityMenu,
  ExtensionResolvedSettingsPanel,
  ExtensionSearchOptions,
  ExtensionSearchResult,
  ExtensionSettingsPanelCallbackResult,
  ExtensionSettingsPanelInfo,
  ExtensionSettingsPanelInvokeRequest,
  ExtensionSettingsPanelSubmitRequest,
  ExtensionSourceInfo,
  ExtensionThemeContributionInfo,
  ExtensionUpdateInfo
} from './types'

function unwrapIpcData<T>(
  result: { success: true; data: T } | { success: false; error: string }
): T {
  if (result.success) {
    return result.data
  }

  throw new Error(result.error)
}

function unwrapIpcVoid(result: { success: true } | { success: false; error: string }): void {
  if (!result.success) {
    throw new Error(result.error)
  }
}

export async function getExtensionCatalog(): Promise<ExtensionCatalogInfo[]> {
  return unwrapIpcData(await ipcManager.invoke('extension:get-catalog'))
}

export async function enableExtension(extensionId: string): Promise<void> {
  unwrapIpcVoid(await ipcManager.invoke('extension:enable', extensionId))
}

export async function disableExtension(extensionId: string): Promise<void> {
  unwrapIpcVoid(await ipcManager.invoke('extension:disable', extensionId))
}

export async function installExtension(source: string): Promise<void> {
  unwrapIpcVoid(await ipcManager.invoke('extension:install', source))
}

export async function installExtensionFromFile(filePath: string): Promise<void> {
  unwrapIpcVoid(await ipcManager.invoke('extension:install-from-file', filePath))
}

export async function uninstallExtension(extensionId: string): Promise<void> {
  unwrapIpcVoid(await ipcManager.invoke('extension:uninstall', extensionId))
}

export async function updateExtension(extensionId: string): Promise<void> {
  unwrapIpcVoid(await ipcManager.invoke('extension:update', extensionId))
}

export async function checkExtensionUpdates(): Promise<ExtensionUpdateInfo[]> {
  return unwrapIpcData(await ipcManager.invoke('extension:check-updates'))
}

export async function getExtensionSources(): Promise<ExtensionSourceInfo[]> {
  return unwrapIpcData(await ipcManager.invoke('extension:get-sources'))
}

export async function searchExtensions(
  sourceName: string,
  query: string,
  options?: ExtensionSearchOptions
): Promise<ExtensionSearchResult> {
  return unwrapIpcData(await ipcManager.invoke('extension:search', sourceName, query, options))
}

export async function getExtensionContributionSnapshot(): Promise<ExtensionContributionSnapshot> {
  return unwrapIpcData(await ipcManager.invoke('extension:get-contribution-snapshot'))
}

export async function getExtensionSettingsPanels(): Promise<readonly ExtensionSettingsPanelInfo[]> {
  return unwrapIpcData(await ipcManager.invoke('extension:get-settings-panels'))
}

export async function resolveExtensionEntityMenu(
  input: EntityMenuResolveInput
): Promise<ExtensionResolvedEntityMenu> {
  return unwrapIpcData(await ipcManager.invoke('extension:resolve-entity-menu', input))
}

export async function invokeExtensionEntityMenu(
  request: ExtensionEntityMenuInvokeRequest
): Promise<ExtensionEntityMenuInvokeResult> {
  return unwrapIpcData(await ipcManager.invoke('extension:invoke-entity-menu', request))
}

export async function resolveExtensionSettingsPanel(
  extensionId: string,
  panelId: string
): Promise<ExtensionResolvedSettingsPanel> {
  return unwrapIpcData(
    await ipcManager.invoke('extension:resolve-settings-panel', extensionId, panelId)
  )
}

export async function submitExtensionSettingsPanel(
  request: ExtensionSettingsPanelSubmitRequest
): Promise<ExtensionSettingsPanelCallbackResult> {
  return unwrapIpcData(await ipcManager.invoke('extension:submit-settings-panel', request))
}

export async function invokeExtensionSettingsPanel(
  request: ExtensionSettingsPanelInvokeRequest
): Promise<ExtensionSettingsPanelCallbackResult> {
  return unwrapIpcData(await ipcManager.invoke('extension:invoke-settings-panel', request))
}

export async function getExtensionThemeContributions(): Promise<
  readonly ExtensionThemeContributionInfo[]
> {
  return unwrapIpcData(await ipcManager.invoke('extension:get-theme-contributions'))
}
