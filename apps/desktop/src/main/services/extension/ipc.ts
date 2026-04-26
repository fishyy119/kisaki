import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { IpcService } from '@main/services/ipc'
import type {
  ExtensionCatalogInfo,
  ExtensionRegistryEntry,
  ExtensionUpdateInfo as SharedExtensionUpdateInfo
} from '@shared/extension'
import type {
  ExtensionCatalogEntry,
  ExtensionSearchOptions,
  ExtensionSourceEntry,
  ExtensionUpdateInfo
} from './types'
import type { ExtensionRuntimeState } from './runtime/manager'
import type { ExtensionService } from './service'

export function registerExtensionIpc(service: ExtensionService, ipc: IpcService): void {
  ipc.handle('extension:disable', async (_, extensionId: string) => {
    try {
      await service.disable(extensionId)
      return { success: true }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:enable', async (_, extensionId: string) => {
    try {
      await service.enable(extensionId)
      return { success: true }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:is-enabled', async (_, extensionId: string) => {
    try {
      return { success: true, data: await service.isEnabled(extensionId) }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:install', async (_, source: string) => {
    try {
      await service.install(source)
      return { success: true }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:install-from-file', async (_, filePath: string) => {
    try {
      await service.installFromFile(filePath)
      return { success: true }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:uninstall', async (_, extensionId: string) => {
    try {
      await service.uninstall(extensionId)
      return { success: true }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:check-updates', async () => {
    try {
      return {
        success: true,
        data: (await service.checkUpdates()).map(toSharedExtensionUpdateInfo)
      }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:update', async (_, extensionId: string) => {
    try {
      await service.update(extensionId)
      return { success: true }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:reload', async (_, extensionId: string) => {
    try {
      await service.reload(extensionId)
      return { success: true }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:get-catalog', async () => {
    try {
      await service.refreshCatalog()
      return {
        success: true,
        data: service
          .getCatalog()
          .map((entry) => toExtensionCatalogInfo(entry, service.getRuntimeState(entry.id)))
      }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:get-contribution-snapshot', () => {
    try {
      return {
        success: true,
        data: service.getContributionSnapshot()
      }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:get-settings-panels', () => {
    try {
      return {
        success: true,
        data: service.getSettingsPanels()
      }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:resolve-entity-menu', async (_, input) => {
    try {
      return {
        success: true,
        data: await service.resolveEntityMenu(input)
      }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:invoke-entity-menu', async (_, request) => {
    try {
      return {
        success: true,
        data: await service.invokeEntityMenuCallback(request)
      }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:release-entity-menu-session', async (_, sessionId: string) => {
    try {
      await service.releaseEntityMenuSession(sessionId)
      return { success: true }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:resolve-settings-panel', async (_, extensionId, panelId) => {
    try {
      return {
        success: true,
        data: await service.resolveSettingsPanel(extensionId, panelId)
      }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:submit-settings-panel', async (_, request) => {
    try {
      return {
        success: true,
        data: await service.submitSettingsPanel(request)
      }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:invoke-settings-panel', async (_, request) => {
    try {
      return {
        success: true,
        data: await service.invokeSettingsPanelCallback(request)
      }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle(
    'extension:release-settings-panel-session',
    async (_, extensionId: string, panelId: string, sessionId: string) => {
      try {
        await service.releaseSettingsPanelSession(extensionId, panelId, sessionId)
        return { success: true }
      } catch (error) {
        return { success: false, error: toErrorMessage(error) }
      }
    }
  )

  ipc.handle('extension:get-theme-contributions', () => {
    try {
      return {
        success: true,
        data: service.getThemeContributions()
      }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:get-sources', () => {
    try {
      return {
        success: true,
        data: [...service.getSearchableSources()]
      }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle(
    'extension:search',
    async (_, sourceName: string, query: string, options?: ExtensionSearchOptions) => {
      try {
        const result = await service.searchSource(sourceName, query, options)
        return {
          success: true,
          data: {
            entries: result.entries.map(toExtensionRegistryEntry),
            total: result.total,
            hasMore: result.hasMore
          }
        }
      } catch (error) {
        return { success: false, error: toErrorMessage(error) }
      }
    }
  )
}

function toExtensionCatalogInfo(
  entry: ExtensionCatalogEntry,
  runtimeState: ExtensionRuntimeState | null
): ExtensionCatalogInfo {
  const runtimeStatus =
    entry.enabled && entry.status === 'ready' ? (runtimeState?.status ?? 'stopped') : 'stopped'
  const runtimeError = runtimeStatus === 'failed' ? (runtimeState?.error ?? null) : null

  return {
    id: entry.id,
    name: entry.manifest?.name ?? entry.id,
    version: entry.version,
    description: entry.manifest?.description,
    author: entry.manifest?.author,
    homepage: entry.manifest?.homepage,
    iconUrl: entry.manifest?.icon
      ? pathToFileURL(path.join(entry.packagePath, entry.manifest.icon)).toString()
      : undefined,
    categories: entry.categories,
    enabled: entry.enabled,
    status: entry.status,
    runtimeStatus,
    runtimeError,
    source: entry.source,
    directory: entry.packagePath,
    issues: entry.issues
  }
}

function toSharedExtensionUpdateInfo(update: ExtensionUpdateInfo): SharedExtensionUpdateInfo {
  return {
    extensionId: update.extensionId,
    currentVersion: update.currentVersion,
    latestVersion: update.latestVersion,
    source: update.source
  }
}

function toExtensionRegistryEntry(entry: ExtensionSourceEntry): ExtensionRegistryEntry {
  return {
    id: entry.id,
    name: entry.name,
    version: entry.version,
    description: entry.description,
    author: entry.author,
    homepage: entry.homepage,
    categories: entry.categories,
    downloadUrl: entry.downloadUrl,
    provider: entry.provider,
    locator: entry.locator,
    iconUrl: entry.iconUrl,
    stars: entry.stars,
    updatedAt: entry.updatedAt
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown extension service error'
}
