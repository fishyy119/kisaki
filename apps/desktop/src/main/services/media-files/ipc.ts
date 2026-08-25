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

  ipc.handle('media-files:sync-comic', async (_, params) =>
    wrapIpc(() => service.comic.sync(params))
  )

  ipc.handle('media-files:attach-comic-chapter-file', async (_, params) =>
    wrapIpcVoid(() => service.comic.attachFile(params))
  )

  ipc.handle('media-files:sync-novel', async (_, params) =>
    wrapIpc(() => service.novel.sync(params))
  )

  ipc.handle('media-files:attach-novel-volume-file', async (_, params) =>
    wrapIpcVoid(() => service.novel.attachFile(params))
  )
}
