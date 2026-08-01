import type { BootstrapHooks } from '@main/bootstrap/hooks'
import type { DbHooks } from '@main/services/db/hooks'
import type { I18nHooks } from '@main/services/i18n/hooks'
import type { WindowHooks } from '@main/services/window/hooks'
import type { ExtensionHookContributionPoint } from '../point'

/** Binds app-level module hooks to their public hook points. */
export function bindAppHookPoints(
  bootstrap: BootstrapHooks,
  db: DbHooks,
  i18n: I18nHooks,
  window: WindowHooks,
  point: ExtensionHookContributionPoint
): void {
  bootstrap.appReady.tap(() => point.notify('app.ready', {}))
  bootstrap.appShuttingDown.tap(() => point.settle('app.shutting-down', {}))
  db.settingsChanged.tap((p) => point.notify('app.settings.changed', p))
  i18n.uiLocaleChanged.tap((p) => point.notify('app.ui-locale.changed', p))
  window.themeChanged.tap((theme) => point.notify('app.theme.changed', { theme }))
}
