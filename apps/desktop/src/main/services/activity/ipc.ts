import type { IpcService } from '@main/services/ipc'
import { wrapIpc } from '@main/services/ipc'
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

  ipc.handle('activity:watch-anime', async (_, animeId, episodeId) =>
    wrapIpc(() => service.anime.watch(animeId, episodeId))
  )

  ipc.handle('activity:stop-anime', async (_, animeId) =>
    wrapIpc(() => service.anime.stop(animeId))
  )

  ipc.handle('activity:play-anime-extra', async (_, extraId) =>
    wrapIpc(() => service.anime.playExtra(extraId))
  )

  ipc.handle('activity:list-anime-watching', async () =>
    wrapIpc(() => service.anime.listWatching())
  )
}
