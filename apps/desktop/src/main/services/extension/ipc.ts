import type { IpcService } from '@main/services/ipc'
import { wrapIpc, wrapIpcVoid } from '@main/services/ipc'
import type { ExtensionService } from './service'

export function registerExtensionIpc(service: ExtensionService, ipc: IpcService): void {
  ipc.handle('extension:disable', async (_, extensionId) =>
    wrapIpcVoid(() => service.disable(extensionId))
  )

  ipc.handle('extension:enable', async (_, extensionId) =>
    wrapIpcVoid(() => service.enable(extensionId))
  )

  ipc.handle('extension:is-enabled', async (_, extensionId) =>
    wrapIpc(() => service.isEnabled(extensionId))
  )

  ipc.handle('extension:create-install-plan', async (_, request) =>
    wrapIpc(() => service.createInstallPlan(request))
  )

  ipc.handle('extension:install-release', async (_, request) =>
    wrapIpcVoid(() => service.installRelease(request))
  )

  ipc.handle('extension:install-from-file', async (_, request) =>
    wrapIpcVoid(() => service.installFromFile(request))
  )

  ipc.handle('extension:uninstall', async (_, extensionId) =>
    wrapIpcVoid(() => service.uninstall(extensionId))
  )

  ipc.handle('extension:purge-data', async (_, request) =>
    wrapIpcVoid(() => service.purgeData(request))
  )

  ipc.handle('extension:check-updates', async () => wrapIpc(() => service.checkUpdates()))

  ipc.handle('extension:update', async (_, request) => wrapIpcVoid(() => service.update(request)))

  ipc.handle('extension:update-all', async () => wrapIpc(() => service.updateAll()))

  ipc.handle('extension:set-update-policy', async (_, request) =>
    wrapIpcVoid(() => service.setUpdatePolicy(request))
  )

  ipc.handle('extension:cancel-operation', (_, operationId) =>
    wrapIpc(() => service.cancelOperation(operationId))
  )

  ipc.handle('extension:reload', async (_, extensionId) =>
    wrapIpcVoid(() => service.reload(extensionId))
  )

  ipc.handle('extension:get-installed-packages', async () =>
    wrapIpc(() => service.listInstalledPackageInfo())
  )

  ipc.handle('extension:list-trusted-signers', () => wrapIpc(() => service.listTrustedSigners()))

  ipc.handle('extension:remove-trusted-signer', async (_, trustedSignerId) =>
    wrapIpcVoid(() => service.removeTrustedSigner(trustedSignerId))
  )

  ipc.handle('extension:list-repositories', () => wrapIpc(() => service.listRepositories()))

  ipc.handle('extension:add-repository', async (_, request) =>
    wrapIpc(() => service.addRepository(request))
  )

  ipc.handle('extension:update-repository', async (_, request) =>
    wrapIpc(() => service.updateRepository(request))
  )

  ipc.handle('extension:remove-repository', async (_, repositoryId) =>
    wrapIpcVoid(() => service.removeRepository(repositoryId))
  )

  ipc.handle('extension:refresh-repository', async (_, repositoryId) =>
    wrapIpc(() => service.refreshRepository(repositoryId))
  )

  ipc.handle('extension:refresh-repositories', async () =>
    wrapIpc(() => service.refreshRepositories())
  )

  ipc.handle('extension:search-catalog', (_, request) =>
    wrapIpc(() => service.searchCatalog(request))
  )

  ipc.handle('extension:get-contribution-snapshot', () =>
    wrapIpc(() => service.getContributionSnapshot())
  )

  ipc.handle('extension:get-settings-panel-contributions', () =>
    wrapIpc(() => service.getSettingsPanelContributions())
  )

  ipc.handle('extension:resolve-entity-menu', async (_, request) =>
    wrapIpc(() => service.resolveEntityMenu(request))
  )

  ipc.handle('extension:invoke-entity-menu', async (_, request) =>
    wrapIpc(() => service.invokeEntityMenuCallback(request))
  )

  ipc.handle('extension:release-entity-menu', async (_, request) =>
    wrapIpcVoid(() => service.releaseEntityMenu(request))
  )

  ipc.handle('extension:open-settings-panel', async (_, request) =>
    wrapIpc(() => service.openSettingsPanel(request))
  )

  ipc.handle('extension:refresh-settings-panel', async (_, request) =>
    wrapIpc(() => service.refreshSettingsPanel(request))
  )

  ipc.handle('extension:submit-settings-panel', async (_, request) =>
    wrapIpc(() => service.submitSettingsPanel(request))
  )

  ipc.handle('extension:invoke-settings-panel-node', async (_, request) =>
    wrapIpc(() => service.invokeSettingsPanelNode(request))
  )

  ipc.handle('extension:release-settings-panel', async (_, request) =>
    wrapIpcVoid(() => service.releaseSettingsPanel(request))
  )

  ipc.handle('extension:get-theme-contributions', () =>
    wrapIpc(() => service.getThemeContributions())
  )
}
