import type { IpcService } from '@main/services/ipc'
import { wrapIpc, wrapIpcVoid } from '@main/services/ipc'
import type { HoldingsService } from './service'

export function registerHoldingsIpc(service: HoldingsService, ipc: IpcService): void {
  ipc.handle('holdings:sync-anime', async (_, params) => wrapIpc(() => service.anime.sync(params)))

  ipc.handle('holdings:attach-anime-episode-file', async (_, params) =>
    wrapIpcVoid(() => service.anime.attachFile(params))
  )

  ipc.handle('holdings:attach-anime-extra-file', async (_, params) =>
    wrapIpcVoid(() => service.anime.attachExtra(params))
  )

  ipc.handle('holdings:sync-comic', async (_, params) => wrapIpc(() => service.comic.sync(params)))

  ipc.handle('holdings:attach-comic-chapter-file', async (_, params) =>
    wrapIpcVoid(() => service.comic.attachFile(params))
  )

  ipc.handle('holdings:sync-novel', async (_, params) => wrapIpc(() => service.novel.sync(params)))

  ipc.handle('holdings:attach-novel-volume-file', async (_, params) =>
    wrapIpcVoid(() => service.novel.attachFile(params))
  )
}
