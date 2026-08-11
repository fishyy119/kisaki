import type { ActivityHooks } from '@main/services/activity'
import type { ExtensionHookContributionPoint } from '../point'

/** Binds activity module hooks to their public play hook points. */
export function bindPlayHookPoints(
  activity: ActivityHooks,
  point: ExtensionHookContributionPoint
): void {
  activity.gameLaunching.tap((value) => point.transform('play.game.launching', value))
  activity.sessionStarted.tap((payload) => point.notify('play.session.started', payload))
  activity.sessionEnding.tap((value) => point.transform('play.session.ending', value))
  activity.sessionEnded.tap((payload) => point.notify('play.session.ended', payload))
  activity.watchStarted.tap((payload) => point.notify('play.anime.watch.started', payload))
  activity.watchEnded.tap((payload) => point.notify('play.anime.watch.ended', payload))
}
