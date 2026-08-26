import { BrowserWindow } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import type { IpcService } from '@main/services/ipc'
import { wrapIpc, wrapIpcVoid } from '@main/services/ipc'
import type { ActivityService } from './service'

export function registerActivityIpc(service: ActivityService, ipc: IpcService): void {
  ipc.handle('activity:launch-game', async (_, gameId) =>
    wrapIpc(() => service.game.launch(gameId))
  )

  ipc.handle('activity:stop-game', async (_, gameId) => wrapIpc(() => service.game.stop(gameId)))

  ipc.handle('activity:list-game-statuses', async () => wrapIpc(() => service.game.listStatuses()))

  ipc.handle('activity:compute-game-monitor-path', async (_, config) =>
    wrapIpc(() => service.game.computeEffectivePath(config))
  )

  ipc.handle('activity:watch-anime', async (_, animeId, episodeId, fileId) =>
    wrapIpc(() => service.anime.watch(animeId, episodeId, fileId))
  )

  ipc.handle('activity:stop-anime', async (_, animeId) =>
    wrapIpc(() => service.anime.stop(animeId))
  )

  ipc.handle('activity:play-anime-extra', async (_, extraId, fileId) =>
    wrapIpc(() => service.anime.playExtra(extraId, fileId))
  )

  ipc.handle('activity:stop-anime-extra', async (_, extraId) =>
    wrapIpc(() => service.anime.stopExtra(extraId))
  )

  ipc.handle('activity:list-anime-watching', async () =>
    wrapIpc(() => service.anime.listWatching())
  )

  ipc.handle('activity:list-anime-extras-playing', async () =>
    wrapIpc(() => service.anime.listPlayingExtras())
  )

  ipc.handle('activity:read-comic', async (_, comicId, chapterId, fileId) =>
    wrapIpc(() => service.comic.read(comicId, chapterId, fileId))
  )

  ipc.handle('activity:read-novel', async (_, novelId, volumeId, fileId) =>
    wrapIpc(() => service.novel.read(novelId, volumeId, fileId))
  )

  ipc.handle('activity:list-comic-reading', async () => wrapIpc(() => service.comic.listReading()))

  ipc.handle('activity:list-novel-reading', async () => wrapIpc(() => service.novel.listReading()))

  ipc.handle('activity:list-novel-bookmarks', async (event, novelId) =>
    wrapIpc(() => service.annotations.listNovelBookmarks(senderWindowId(event), novelId))
  )

  ipc.handle('activity:create-novel-bookmark', async (event, input) =>
    wrapIpc(() => service.annotations.createNovelBookmark(senderWindowId(event), input))
  )

  ipc.handle('activity:update-novel-bookmark', async (event, id, updates) =>
    wrapIpcVoid(() => {
      service.annotations.updateNovelBookmark(senderWindowId(event), id, updates)
    })
  )

  ipc.handle('activity:delete-novel-bookmark', async (event, id) =>
    wrapIpcVoid(() => {
      service.annotations.deleteNovelBookmark(senderWindowId(event), id)
    })
  )

  ipc.handle('activity:list-novel-highlights', async (event, novelId) =>
    wrapIpc(() => service.annotations.listNovelHighlights(senderWindowId(event), novelId))
  )

  ipc.handle('activity:create-novel-highlight', async (event, input) =>
    wrapIpc(() => service.annotations.createNovelHighlight(senderWindowId(event), input))
  )

  ipc.handle('activity:update-novel-highlight', async (event, id, updates) =>
    wrapIpcVoid(() => {
      service.annotations.updateNovelHighlight(senderWindowId(event), id, updates)
    })
  )

  ipc.handle('activity:delete-novel-highlight', async (event, id) =>
    wrapIpcVoid(() => {
      service.annotations.deleteNovelHighlight(senderWindowId(event), id)
    })
  )

  ipc.handle('activity:list-comic-bookmarks', async (event, comicId) =>
    wrapIpc(() => service.annotations.listComicBookmarks(senderWindowId(event), comicId))
  )

  ipc.handle('activity:toggle-comic-bookmark', async (event, input) =>
    wrapIpc(() => service.annotations.toggleComicBookmark(senderWindowId(event), input))
  )

  ipc.handle('activity:update-comic-bookmark', async (event, id, updates) =>
    wrapIpcVoid(() => {
      service.annotations.updateComicBookmark(senderWindowId(event), id, updates)
    })
  )

  ipc.handle('activity:delete-comic-bookmark', async (event, id) =>
    wrapIpcVoid(() => {
      service.annotations.deleteComicBookmark(senderWindowId(event), id)
    })
  )
}

function senderWindowId(event: IpcMainInvokeEvent): number {
  return BrowserWindow.fromWebContents(event.sender)?.id ?? -1
}
