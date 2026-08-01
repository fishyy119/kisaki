import type { JsonValue, UiLocale } from '../../../shared'
import type { HookPointSpec } from './point'

export type AppEmptyPayload = Record<string, never>

export interface AppSettingChangedPayload {
  setting: string
  value: JsonValue | undefined
}

export interface AppUiLocaleChangedPayload {
  preference: UiLocale | null
  effective: UiLocale
}

export type AppTheme = 'light' | 'dark' | 'system'

export interface AppThemeChangedPayload {
  theme: AppTheme
}

/**
 * App hook points.
 *
 * All notifications. `app.shutting-down` is awaited by the shutdown sequence
 * within a bounded budget, so handlers can flush state while the host is
 * still alive.
 */
export interface AppHookPoints {
  'app.ready': HookPointSpec<'notify', AppEmptyPayload>
  'app.shutting-down': HookPointSpec<'notify', AppEmptyPayload>
  'app.settings.changed': HookPointSpec<'notify', AppSettingChangedPayload>
  'app.ui-locale.changed': HookPointSpec<'notify', AppUiLocaleChangedPayload>
  'app.theme.changed': HookPointSpec<'notify', AppThemeChangedPayload>
}
