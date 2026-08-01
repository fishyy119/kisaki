/**
 * I18n module hooks.
 */

import { createNotifyHook, type NotifyHook } from '@main/hooks'
import type { UiLocaleState } from '@shared/i18n'

export interface I18nHooks {
  /** Fires after the UI locale preference is persisted and resolved. */
  uiLocaleChanged: NotifyHook<UiLocaleState>
}

export function createI18nHooks(): I18nHooks {
  return {
    uiLocaleChanged: createNotifyHook<UiLocaleState>('app.ui-locale.changed')
  }
}
