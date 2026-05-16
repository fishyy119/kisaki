import type { IpcService } from '@main/services/ipc'
import { wrapIpc } from '@main/services/ipc'
import type { DeeplinkService } from './service'

export function registerDeeplinkIpc(service: DeeplinkService, ipc: IpcService): void {
  ipc.handle('deeplink:handle', async (_, url) => wrapIpc(() => service.handleDeeplink(url)))

  ipc.handle('deeplink:list-routes', () => wrapIpc(() => service.router.listRoutes()))
}
