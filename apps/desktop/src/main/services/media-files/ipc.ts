import type { IpcService } from '@main/services/ipc'
import { wrapIpc, wrapIpcVoid } from '@main/services/ipc'
import type { MediaFilesService } from './service'

export function registerMediaFilesIpc(service: MediaFilesService, ipc: IpcService): void {
  ipc.handle('media-files:sync-anime', async (_, params) =>
    wrapIpc(() => service.anime.sync(params))
  )

  ipc.handle('media-files:attach-anime-episode-file', async (_, params) =>
    wrapIpcVoid(() => service.anime.attachFile(params))
  )

  ipc.handle('media-files:attach-anime-extra-file', async (_, params) =>
    wrapIpcVoid(() => service.anime.attachExtra(params))
  )
}
