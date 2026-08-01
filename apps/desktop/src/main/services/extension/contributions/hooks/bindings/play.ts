import type { LauncherHooks } from '@main/services/launcher/hooks'
import type { MonitorHooks } from '@main/services/monitor/hooks'
import type { ExtensionHookContributionPoint } from '../point'

/** Binds launcher and monitor module hooks to their public play hook points. */
export function bindPlayHookPoints(
  launcher: LauncherHooks,
  monitor: MonitorHooks,
  point: ExtensionHookContributionPoint
): void {
  launcher.gameLaunching.tap((value) => point.transform('play.game.launching', value))
  monitor.sessionStarted.tap((p) => point.notify('play.session.started', p))
  monitor.sessionEnding.tap((value) => point.transform('play.session.ending', value))
  monitor.sessionEnded.tap((p) => point.notify('play.session.ended', p))
}
