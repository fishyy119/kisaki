/**
 * Window module hooks.
 */

import { createNotifyHook, type NotifyHook } from '@main/hooks'
import type { AppTheme } from '@shared/common'

export interface WindowHooks {
  /** Fires when the renderer theme preference changes. */
  themeChanged: NotifyHook<AppTheme>
}

export function createWindowHooks(): WindowHooks {
  return {
    themeChanged: createNotifyHook<AppTheme>('app.theme.changed')
  }
}
