/**
 * Activity Service
 *
 * Business owner of media consumption: which entity is being consumed right
 * now, how a consumption action starts and stops, and what a finished session
 * records. Technical mechanics live in the `process`, `video`, and `reader`
 * services. Every media type is addressed as `activity.<media>`: game and anime
 * have their own coordinators, while comic and novel are two faces of one
 * reading coordinator over per-media adapters, because reading is a closed pair
 * with identical session mechanics.
 */

import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import { AnimeActivityCoordinator } from './anime/coordinator'
import { GameActivityCoordinator } from './game/coordinator'
import { createActivityHooks } from './hooks'
import { registerActivityIpc } from './ipc'
import { createLaunchRoute, LAUNCH_DEEPLINK_ROUTE } from './launch-route'
import { ComicReadingAdapter } from './reading/comic'
import { ReadingCoordinator, type ReadingApi } from './reading/coordinator'
import { ReadingMarks } from './reading/marks'
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
    'notification',
    'process',
    'video',
    'reader',
    'attachment'
  ] as const satisfies readonly ServiceName[]
  readonly hooks = createActivityHooks()

  game!: GameActivityCoordinator
  anime!: AnimeActivityCoordinator
  comic!: ReadingApi<'comic'>
  novel!: ReadingApi<'novel'>
  /** Bookmarks and highlights made from reader windows. */
  readingMarks!: ReadingMarks

  private reading!: ReadingCoordinator
  private unregisterLaunchRoute?: () => void

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const ipc = container.get('ipc')
    const db = container.get('db')
    const i18n = container.get('i18n')
    const reader = container.get('reader')

    this.game = new GameActivityCoordinator(
      db,
      container.get('process'),
      container.get('native'),
      i18n,
      ipc,
      container.get('attachment').game.saves,
      this.hooks
    )

    this.anime = new AnimeActivityCoordinator(db, container.get('video'), ipc, this.hooks)
    this.reading = new ReadingCoordinator(reader, {
      comic: new ComicReadingAdapter(db, i18n, ipc, this.hooks),
      novel: new NovelReadingAdapter(db, i18n, ipc, this.hooks)
    })
    this.comic = this.reading.forMedia('comic')
    this.novel = this.reading.forMedia('novel')
    this.readingMarks = new ReadingMarks(db, reader)

    registerActivityIpc(this, ipc)

    // Launching is an activity action, so activity owns the route that triggers
    // it; the deeplink router stays free of domain vocabulary. The launched
    // engine takes the screen itself, so the route never steals focus.
    this.unregisterLaunchRoute = container
      .get('deeplink')
      .router.register(
        LAUNCH_DEEPLINK_ROUTE,
        createLaunchRoute(this, container.get('notification'), i18n),
        { focus: false }
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
