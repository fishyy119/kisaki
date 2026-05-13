import { pathToFileURL } from 'node:url'
import type { IpcService } from '@main/services/ipc'
import type { IpcError } from '@shared/ipc'
import type { ExtensionInstalledPackageInfo } from '@shared/extension'
import { readErrorCode, readErrorDetails } from '@kisaki/extension-api'
import type { ExtensionCatalogEntry } from '../types'
import type { ExtensionRuntimeState } from '../runtime/manager'
import type { ExtensionService } from '../service'
import { ExtensionPackageError } from '../packages/types'
import { resolveExtensionFilePath } from '../packages/manifest'
import { requireSafeExtensionId } from '../shared/path-confinement'
import {
  requireCatalogSearchRequest,
  requireCreateInstallPlanRequest,
  requireInstallFromFileRequest,
  requireInstallReleaseRequest,
  requireMenuInvokeRequest,
  requireMenuReleaseRequest,
  requireMenuResolveRequest,
  requireNonEmptyString,
  requirePurgeDataRequest,
  requireRepositoryCreateRequest,
  requireRepositoryUpdateRequest,
  requireSettingsInvokeRequest,
  requireSettingsOpenRequest,
  requireSettingsRefreshRequest,
  requireSettingsReleaseRequest,
  requireSettingsSubmitRequest,
  requireUpdatePolicyRequest,
  requireUpdateRequest
} from './validation'

export function registerExtensionIpc(service: ExtensionService, ipc: IpcService): void {
  ipc.handle('extension:disable', async (_, extensionId: string) => {
    try {
      await service.disable(requireSafeExtensionId(extensionId))
      return { success: true }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:enable', async (_, extensionId: string) => {
    try {
      await service.enable(requireSafeExtensionId(extensionId))
      return { success: true }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:is-enabled', async (_, extensionId: string) => {
    try {
      return { success: true, data: await service.isEnabled(requireSafeExtensionId(extensionId)) }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:create-install-plan', async (_, request) => {
    try {
      return {
        success: true,
        data: await service.createInstallPlan(requireCreateInstallPlanRequest(request))
      }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:install-release', async (_, request) => {
    try {
      await service.installRelease(requireInstallReleaseRequest(request))
      return { success: true }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:install-from-file', async (_, request) => {
    try {
      await service.installFromFile(requireInstallFromFileRequest(request))
      return { success: true }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:uninstall', async (_, extensionId: string) => {
    try {
      await service.uninstall(requireSafeExtensionId(extensionId))
      return { success: true }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:purge-data', async (_, request) => {
    try {
      await service.purgeData(requirePurgeDataRequest(request))
      return { success: true }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:check-updates', async () => {
    try {
      const result = await service.checkUpdates()
      return {
        success: true,
        data: {
          updates: result.updates,
          unavailable: result.unavailable
        }
      }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:update', async (_, request) => {
    try {
      await service.update(requireUpdateRequest(request))
      return { success: true }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:update-all', async () => {
    try {
      return {
        success: true,
        data: await service.updateAll()
      }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:set-update-policy', async (_, request) => {
    try {
      await service.setUpdatePolicy(requireUpdatePolicyRequest(request))
      return { success: true }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:cancel-operation', (_, operationId: string) => {
    try {
      return {
        success: true,
        data: service.cancelOperation(requireNonEmptyString(operationId, 'operationId'))
      }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:reload', async (_, extensionId: string) => {
    try {
      await service.reload(requireSafeExtensionId(extensionId))
      return { success: true }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:get-installed-packages', async () => {
    try {
      await service.refreshCatalog()
      return {
        success: true,
        data: service
          .getCatalog()
          .map((entry) => toExtensionInstalledPackageInfo(entry, service.getRuntimeState(entry.id)))
      }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:list-trusted-signers', () => {
    try {
      return {
        success: true,
        data: service.listTrustedSigners()
      }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:remove-trusted-signer', async (_, trustedSignerId: string) => {
    try {
      await service.removeTrustedSigner(requireNonEmptyString(trustedSignerId, 'trustedSignerId'))
      return { success: true }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:list-repositories', () => {
    try {
      return {
        success: true,
        data: service.listRepositories()
      }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:add-repository', async (_, request) => {
    try {
      return {
        success: true,
        data: await service.addRepository(requireRepositoryCreateRequest(request))
      }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:update-repository', async (_, request) => {
    try {
      return {
        success: true,
        data: await service.updateRepository(requireRepositoryUpdateRequest(request))
      }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:remove-repository', async (_, repositoryId: string) => {
    try {
      service.removeRepository(requireRepositoryId(repositoryId))
      return { success: true }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:refresh-repository', async (_, repositoryId: string) => {
    try {
      return {
        success: true,
        data: await service.refreshRepository(requireRepositoryId(repositoryId))
      }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:refresh-repositories', async () => {
    try {
      return {
        success: true,
        data: await service.refreshRepositories()
      }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:search-catalog', (_, request) => {
    try {
      return {
        success: true,
        data: service.searchCatalog(requireCatalogSearchRequest(request))
      }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:get-contribution-snapshot', () => {
    try {
      return {
        success: true,
        data: service.getContributionSnapshot()
      }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:get-settings-panel-contributions', () => {
    try {
      return {
        success: true,
        data: service.getSettingsPanelContributions()
      }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:resolve-entity-menu', async (_, request) => {
    try {
      return {
        success: true,
        data: await service.resolveEntityMenu(requireMenuResolveRequest(request))
      }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:invoke-entity-menu', async (_, request) => {
    try {
      return {
        success: true,
        data: await service.invokeEntityMenuCallback(requireMenuInvokeRequest(request))
      }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:release-entity-menu', async (_, request) => {
    try {
      await service.releaseEntityMenu(requireMenuReleaseRequest(request))
      return { success: true }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:open-settings-panel', async (_, request) => {
    try {
      const data = await service.openSettingsPanel(requireSettingsOpenRequest(request))
      switch (data.surface) {
        case 'root':
          return { success: true, data }
        case 'dialog':
          return { success: true, data }
        case 'popover':
          return { success: true, data }
      }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:refresh-settings-panel', async (_, request) => {
    try {
      const data = await service.refreshSettingsPanel(requireSettingsRefreshRequest(request))
      switch (data.surface) {
        case 'root':
          return { success: true, data }
        case 'dialog':
          return { success: true, data }
        case 'popover':
          return { success: true, data }
        case 'all':
          return { success: true, data }
      }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:submit-settings-panel', async (_, request) => {
    try {
      return {
        success: true,
        data: await service.submitSettingsPanel(requireSettingsSubmitRequest(request))
      }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:invoke-settings-panel-node', async (_, request) => {
    try {
      return {
        success: true,
        data: await service.invokeSettingsPanelNode(requireSettingsInvokeRequest(request))
      }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:release-settings-panel', async (_, request) => {
    try {
      await service.releaseSettingsPanel(requireSettingsReleaseRequest(request))
      return { success: true }
    } catch (error) {
      return toIpcError(error)
    }
  })

  ipc.handle('extension:get-theme-contributions', () => {
    try {
      return {
        success: true,
        data: service.getThemeContributions()
      }
    } catch (error) {
      return toIpcError(error)
    }
  })
}

function toExtensionInstalledPackageInfo(
  entry: ExtensionCatalogEntry,
  runtimeState: ExtensionRuntimeState | null
): ExtensionInstalledPackageInfo {
  const runtimeStatus =
    entry.enabled && entry.status === 'ready' ? (runtimeState?.status ?? 'stopped') : 'stopped'
  const runtimeError = runtimeStatus === 'failed' ? (runtimeState?.error ?? null) : null
  const runtimeDiagnostics =
    entry.enabled && entry.status === 'ready' ? (runtimeState?.diagnostics ?? []) : []

  return {
    builtin: entry.builtin,
    id: entry.id,
    name: entry.manifest?.name ?? entry.id,
    version: entry.version,
    description: entry.manifest?.description,
    author: entry.manifest?.author,
    homepage: entry.manifest?.homepage,
    iconUrl: entry.manifest?.icon
      ? pathToFileURL(resolveExtensionFilePath(entry.packagePath, entry.manifest.icon)).toString()
      : undefined,
    categories: entry.categories,
    enabled: entry.enabled,
    status: entry.status,
    runtimeStatus,
    runtimeError,
    runtimeDiagnostics,
    installationSource: entry.source,
    updatePolicy: entry.updatePolicy ?? undefined,
    pinnedVersion: entry.pinnedVersion,
    channel: entry.channel,
    directory: entry.packagePath,
    issues: entry.issues
  }
}

function requireRepositoryId(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('repositoryId must be a non-empty string')
  }

  return value.trim()
}

function toIpcError(error: unknown): IpcError {
  return {
    success: false,
    error: toErrorMessage(error),
    code: toExtensionIpcErrorCode(error),
    details: toExtensionIpcErrorDetails(error)
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown extension service error'
}

function toExtensionIpcErrorCode(error: unknown): string {
  const code = readErrorCode(error)
  if (code) {
    return code
  }

  if (error instanceof ExtensionPackageError) {
    return `extension_package_${error.diagnostics[0]?.stage ?? 'operation'}`
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return 'cancelled'
  }

  return 'extension_service_error'
}

function toExtensionIpcErrorDetails(error: unknown): Record<string, unknown> | undefined {
  const details = readErrorDetails(error)
  if (details) {
    return details
  }

  if (error instanceof ExtensionPackageError) {
    return {
      diagnostics: error.diagnostics
    }
  }

  return undefined
}
