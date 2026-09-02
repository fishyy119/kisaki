/**
 * Window module hooks.
 */

import { createNotifyHook, type NotifyHook } from '@main/hooks'
import type { AppTheme } from '@shared/theme'

export type MainWindowDocumentGoneCause = 'navigated' | 'render-process-gone' | 'closed'

export interface WindowHooks {
  /** Fires when the renderer theme preference changes. */
  themeChanged: NotifyHook<AppTheme>
  /**
   * Fires when the main window's renderer document stops existing: navigation
   * (including reloads), renderer crash, or window close. State owned by that
   * document — such as interactive menu sessions — must be released.
   */
  mainWindowDocumentGone: NotifyHook<{ cause: MainWindowDocumentGoneCause }>
}

export function createWindowHooks(): WindowHooks {
  return {
    themeChanged: createNotifyHook<AppTheme>('app.theme.changed'),
    mainWindowDocumentGone: createNotifyHook<{ cause: MainWindowDocumentGoneCause }>(
      'window.main-document-gone'
    )
  }
}
