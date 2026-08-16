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

  ipc.handle('activity:watch-tv', async (_, tvId, episodeId, fileId) =>
    wrapIpc(() => service.tv.watch(tvId, episodeId, fileId))
  )

  ipc.handle('activity:stop-tv', async (_, tvId) => wrapIpc(() => service.tv.stop(tvId)))

  ipc.handle('activity:play-tv-extra', async (_, extraId, fileId) =>
    wrapIpc(() => service.tv.playExtra(extraId, fileId))
  )

  ipc.handle('activity:stop-tv-extra', async (_, extraId) =>
    wrapIpc(() => service.tv.stopExtra(extraId))
  )

  ipc.handle('activity:list-tv-watching', async () => wrapIpc(() => service.tv.listWatching()))

  ipc.handle('activity:list-tv-extras-playing', async () =>
    wrapIpc(() => service.tv.listPlayingExtras())
  )

  ipc.handle('activity:watch-movie', async (_, movieId, fileId) =>
    wrapIpc(() => service.movie.watch(movieId, fileId))
  )

  ipc.handle('activity:stop-movie', async (_, movieId) =>
    wrapIpc(() => service.movie.stop(movieId))
  )

  ipc.handle('activity:play-movie-extra', async (_, extraId, fileId) =>
    wrapIpc(() => service.movie.playExtra(extraId, fileId))
  )

  ipc.handle('activity:stop-movie-extra', async (_, extraId) =>
    wrapIpc(() => service.movie.stopExtra(extraId))
  )

  ipc.handle('activity:list-movie-watching', async () =>
    wrapIpc(() => service.movie.listWatching())
  )

  ipc.handle('activity:list-movie-extras-playing', async () =>
    wrapIpc(() => service.movie.listPlayingExtras())
  )
}
