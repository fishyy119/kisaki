import type { ActivityHooks } from '@main/services/activity'
import type { ExtensionHookContributionPoint } from '../point'

/** Binds activity module hooks to their public `activity.*` hook points. */
export function bindActivityHookPoints(
  activity: ActivityHooks,
  point: ExtensionHookContributionPoint
): void {
  activity.gameLaunching.tap((value) => point.transform('activity.game.launching', value))
  activity.gamePlayStarted.tap((payload) => point.notify('activity.game.play.started', payload))
  activity.gamePlayEnding.tap((value) => point.transform('activity.game.play.ending', value))
  activity.gamePlayEnded.tap((payload) => point.notify('activity.game.play.ended', payload))
  activity.animeWatchStarted.tap((payload) => point.notify('activity.anime.watch.started', payload))
  activity.animeWatchEnded.tap((payload) => point.notify('activity.anime.watch.ended', payload))
  activity.comicReadStarted.tap((payload) => point.notify('activity.comic.read.started', payload))
  activity.comicReadEnded.tap((payload) => point.notify('activity.comic.read.ended', payload))
  activity.novelReadStarted.tap((payload) => point.notify('activity.novel.read.started', payload))
  activity.novelReadEnded.tap((payload) => point.notify('activity.novel.read.ended', payload))
}
