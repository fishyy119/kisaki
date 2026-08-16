import type { ActivityHooks } from '@main/services/activity'
import type { ExtensionHookContributionPoint } from '../point'

/** Binds activity module hooks to their public play hook points. */
export function bindPlayHookPoints(
  activity: ActivityHooks,
  point: ExtensionHookContributionPoint
): void {
  activity.gameLaunching.tap((value) => point.transform('play.game.launching', value))
  activity.gameSessionStarted.tap((payload) => point.notify('play.game.session.started', payload))
  activity.gameSessionEnding.tap((value) => point.transform('play.game.session.ending', value))
  activity.gameSessionEnded.tap((payload) => point.notify('play.game.session.ended', payload))
  activity.animeWatchStarted.tap((payload) => point.notify('play.anime.watch.started', payload))
  activity.animeWatchEnded.tap((payload) => point.notify('play.anime.watch.ended', payload))
  activity.tvWatchStarted.tap((payload) => point.notify('play.tv.watch.started', payload))
  activity.tvWatchEnded.tap((payload) => point.notify('play.tv.watch.ended', payload))
  activity.movieWatchStarted.tap((payload) => point.notify('play.movie.watch.started', payload))
  activity.movieWatchEnded.tap((payload) => point.notify('play.movie.watch.ended', payload))
}
