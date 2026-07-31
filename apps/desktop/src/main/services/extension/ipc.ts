import type { IpcService } from '@main/services/ipc'
import { wrapIpc, wrapIpcVoid } from '@main/services/ipc'
import { createApplyReleaseCommandFromRequest } from './installer'
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

  ipc.handle('extension:create-release-plan', async (_, request) =>
    wrapIpc(() => service.installer.createReleasePlan(request))
  )

  ipc.handle('extension:apply-release', async (_, request) =>
    wrapIpc(() =>
      service.installer.startApplyRelease(createApplyReleaseCommandFromRequest(request))
    )
  )

  ipc.handle('extension:uninstall', async (_, extensionId) =>
    wrapIpcVoid(() => service.installations.uninstall(extensionId))
  )

  ipc.handle('extension:purge-data', async (_, request) =>
    wrapIpcVoid(() => service.installations.purgeData(request))
  )

  ipc.handle('extension:check-updates', async () => wrapIpc(() => service.updates.checkUpdates()))

  ipc.handle('extension:get-automatic-update-run', () =>
    wrapIpc(() => service.updates.getAutomaticUpdateRun())
  )

  ipc.handle('extension:set-update-policy', async (_, request) =>
    wrapIpcVoid(() => service.installations.setUpdatePolicy(request))
  )

  ipc.handle('extension:reload', async (_, extensionId) =>
    wrapIpcVoid(() => service.installations.reload(extensionId))
  )

  ipc.handle('extension:restart-host', async () =>
    wrapIpcVoid(() => service.installations.restartHost())
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
    wrapIpc(() => service.repositories.startRefreshRepository(repositoryId))
  )

  ipc.handle('extension:refresh-repositories', async () =>
    wrapIpc(() => service.repositories.startRefreshRepositories())
  )

  ipc.handle('extension:search-catalog', (_, request) =>
    wrapIpc(() => service.repositories.searchCatalog(request))
  )

  ipc.handle('extension:get-contribution-snapshot', () =>
    wrapIpc(() => service.contributions.getSnapshot())
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

  ipc.handle('extension:run-card-action', async (_, request) =>
    wrapIpcVoid(() => service.contributions.runCardAction(request))
  )

  ipc.handle('extension:get-webview-sessions', () =>
    wrapIpc(() => service.capabilities.webviews.listSessions())
  )

  ipc.handle('extension:open-webview-page', async (_, request) =>
    wrapIpc(() => service.capabilities.webviews.openPageFromRenderer(request))
  )

  ipc.handle('extension:post-webview-message', async (_, request) =>
    wrapIpcVoid(() =>
      service.capabilities.webviews.postMessageToHost(request.webviewId, request.message)
    )
  )

  ipc.handle('extension:notify-webview-ready', async (_, request) =>
    wrapIpcVoid(() => service.capabilities.webviews.notifyReady(request.webviewId))
  )

  ipc.handle('extension:close-webview', async (_, request) =>
    wrapIpcVoid(() => service.capabilities.webviews.closeFromRenderer(request.webviewId))
  )

  ipc.handle('extension:get-theme-contributions', () =>
    wrapIpc(() => service.contributions.listThemes())
  )
}
