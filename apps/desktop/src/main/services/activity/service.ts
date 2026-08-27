/**
 * Activity Service
 *
 * Business owner of media consumption: which entity is being consumed right
 * now, how a consumption action starts and stops, and what a finished session
 * records. Technical mechanics live in the `process`, `video`, and `reader`
 * services. Game and anime keep explicit per-media handlers; the two reading
 * media share one coordinator over per-media table adapters, because reading
 * is a closed pair with identical session mechanics.
 */

import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import { AnimeActivityHandler } from './handlers/anime'
import { GameActivityHandler } from './handlers/game'
import { createActivityHooks } from './hooks'
import { registerActivityIpc } from './ipc'
import { ActivityLaunchRoute, LAUNCH_DEEPLINK_ROUTE } from './launch-route'
import { ReadingMarks } from './marks'
import { ComicReadingAdapter } from './reading/comic'
import { ReadingCoordinator } from './reading/coordinator'
import { NovelReadingAdapter } from './reading/novel'

const log = createLogger('Activity')

export class ActivityService implements IService<'activity'> {
  readonly id = 'activity'
  readonly deps = [
    'db',
    'deeplink',
    'i18n',
    'ipc',
    'native',
    'notify',
    'process',
    'video',
    'reader',
    'attachment'
  ] as const satisfies readonly ServiceName[]
  readonly hooks = createActivityHooks()

  game!: GameActivityHandler
  anime!: AnimeActivityHandler
  reading!: ReadingCoordinator
  marks!: ReadingMarks

  private unregisterLaunchRoute?: () => void

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const ipc = container.get('ipc')
    const db = container.get('db')
    const i18n = container.get('i18n')
    const reader = container.get('reader')

    this.game = new GameActivityHandler(
      db,
      container.get('process'),
      container.get('native'),
      i18n,
      ipc,
      container.get('attachment').game,
      this.hooks
    )

    this.anime = new AnimeActivityHandler(db, container.get('video'), ipc, this.hooks)
    this.reading = new ReadingCoordinator(reader, {
      comic: new ComicReadingAdapter(db, i18n, ipc, this.hooks),
      novel: new NovelReadingAdapter(db, i18n, ipc, this.hooks)
    })
    this.marks = new ReadingMarks(db, reader)

    registerActivityIpc(this, ipc)

    // Launching is an activity action, so activity owns the route that triggers
    // it; the deeplink router stays free of domain vocabulary.
    this.unregisterLaunchRoute = container
      .get('deeplink')
      .router.register(
        LAUNCH_DEEPLINK_ROUTE,
        new ActivityLaunchRoute(this, container.get('notify'), i18n)
      )

    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    this.unregisterLaunchRoute?.()
    this.unregisterLaunchRoute = undefined
    await this.anime.dispose()
    await this.game.dispose()
    this.reading.dispose()
    log.info('Disposed')
  }
}
