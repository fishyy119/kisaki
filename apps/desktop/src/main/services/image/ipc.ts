import type { IpcService } from '@main/services/ipc'
import { wrapIpc } from '@main/services/ipc'
import type { ImageService } from './service'

export function registerImageIpc(service: ImageService, ipc: IpcService): void {
  ipc.handle('image:crop-to-temp', async (_, input, cropRegion, options) =>
    wrapIpc(() => service.staging.cropToTemp(input, cropRegion, options))
  )

  ipc.handle('image:read-preview', async (_, input) =>
    wrapIpc(() => service.staging.readPreviewDataUrl(input))
  )
}
