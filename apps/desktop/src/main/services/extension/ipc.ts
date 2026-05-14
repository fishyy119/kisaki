import type { IpcService } from '@main/services/ipc'
import { wrapIpc, wrapIpcVoid } from '@main/services/ipc'
import { createInstallReleaseCommandFromRequest } from './installer'
import type { ExtensionService } from './service'

export function registerExtensionIpc(service: ExtensionService, ipc: IpcService): void {
  ipc.handle('extension:disable', async (_, extensionId) =>
    wrapIpcVoid(() => service.installations.disable(extensionId))
  )

  ipc.handle('extension:enable', async (_, extensionId) =>
    wrapIpcVoid(() => service.installations.enable(extensionId))
  )

  ipc.handle('extension:is-enabled', async (_, extensionId) =>
    wrapIpc(() => service.installations.isEnabled(extensionId))
  )

  ipc.handle('extension:create-install-plan', async (_, request) =>
    wrapIpc(() => service.installer.createInstallPlan(request))
  )

  ipc.handle('extension:install-release', async (_, request) =>
    wrapIpcVoid(() =>
      service.installer.installRelease(createInstallReleaseCommandFromRequest(request))
    )
  )

  ipc.handle('extension:install-from-file', async (_, request) =>
    wrapIpcVoid(() => service.installer.installFromFile(request))
  )

  ipc.handle('extension:uninstall', async (_, extensionId) =>
    wrapIpcVoid(() => service.installations.uninstall(extensionId))
  )

  ipc.handle('extension:purge-data', async (_, request) =>
    wrapIpcVoid(() => service.installations.purgeData(request))
  )

  ipc.handle('extension:check-updates', async () => wrapIpc(() => service.updates.checkUpdates()))

  ipc.handle('extension:update', async (_, request) =>
    wrapIpcVoid(() => service.updates.update(request))
  )

  ipc.handle('extension:update-all', async () => wrapIpc(() => service.updates.updateAll()))

  ipc.handle('extension:set-update-policy', async (_, request) =>
    wrapIpcVoid(() => service.installations.setUpdatePolicy(request))
  )

  ipc.handle('extension:cancel-operation', (_, operationId) =>
    wrapIpc(() => service.installer.cancelOperation(operationId))
  )

  ipc.handle('extension:reload', async (_, extensionId) =>
    wrapIpcVoid(() => service.installations.reload(extensionId))
  )

  ipc.handle('extension:get-installed-packages', async () =>
    wrapIpc(() => service.installations.listPackageInfo())
  )

  ipc.handle('extension:list-trusted-signers', () =>
    wrapIpc(() => service.signers.listTrustedSigners())
  )

  ipc.handle('extension:remove-trusted-signer', async (_, trustedSignerId) =>
    wrapIpcVoid(() => service.signers.removeTrustedSigner(trustedSignerId))
  )

  ipc.handle('extension:list-repositories', () =>
    wrapIpc(() => service.repositories.listRepositories())
  )

  ipc.handle('extension:add-repository', async (_, request) =>
    wrapIpc(() => service.repositories.addRepository(request))
  )

  ipc.handle('extension:update-repository', async (_, request) =>
    wrapIpc(() => service.repositories.updateRepository(request))
  )

  ipc.handle('extension:remove-repository', async (_, repositoryId) =>
    wrapIpcVoid(() => service.repositories.removeRepository(repositoryId))
  )

  ipc.handle('extension:refresh-repository', async (_, repositoryId) =>
    wrapIpc(() => service.repositories.refreshRepository(repositoryId))
  )

  ipc.handle('extension:refresh-repositories', async () =>
    wrapIpc(() => service.repositories.refreshRepositories())
  )

  ipc.handle('extension:search-catalog', (_, request) =>
    wrapIpc(() => service.repositories.searchCatalog(request))
  )

  ipc.handle('extension:get-contribution-snapshot', () =>
    wrapIpc(() => service.contributions.getSnapshot())
  )

  ipc.handle('extension:get-settings-panel-contributions', () =>
    wrapIpc(() => service.contributions.listSettingsPanels())
  )

  ipc.handle('extension:resolve-entity-menu', async (_, request) =>
    wrapIpc(() => service.contributions.resolveEntityMenu(request))
  )

  ipc.handle('extension:invoke-entity-menu', async (_, request) =>
    wrapIpc(() => service.contributions.invokeEntityMenuCallback(request))
  )

  ipc.handle('extension:release-entity-menu', async (_, request) =>
    wrapIpcVoid(() => service.contributions.releaseEntityMenu(request))
  )

  ipc.handle('extension:open-settings-panel', async (_, request) =>
    wrapIpc(() => service.contributions.openSettingsPanel(request))
  )

  ipc.handle('extension:refresh-settings-panel', async (_, request) =>
    wrapIpc(() => service.contributions.refreshSettingsPanel(request))
  )

  ipc.handle('extension:submit-settings-panel', async (_, request) =>
    wrapIpc(() => service.contributions.submitSettingsPanel(request))
  )

  ipc.handle('extension:invoke-settings-panel-node', async (_, request) =>
    wrapIpc(() => service.contributions.invokeSettingsPanelNode(request))
  )

  ipc.handle('extension:release-settings-panel', async (_, request) =>
    wrapIpcVoid(() => service.contributions.releaseSettingsPanel(request))
  )

  ipc.handle('extension:get-theme-contributions', () =>
    wrapIpc(() => service.contributions.listThemes())
  )
}
