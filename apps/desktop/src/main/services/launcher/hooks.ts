/**
 * Launcher module hook points.
 *
 * Owned by LauncherService; `gameLaunching` transforms the effective launch
 * configuration right before the launch is executed (never persisted).
 */

import { createWaterfallHook, type WaterfallHook } from '@main/hooks'
import type { Game } from '@shared/db'

export interface GameLaunchConfig {
  gameId: string
  launcherMode: Game['launcherMode']
  launcherPath: string
  gameDirPath: string | null
}

export interface LauncherHooks {
  gameLaunching: WaterfallHook<GameLaunchConfig>
}

export function createLauncherHooks(): LauncherHooks {
  return {
    gameLaunching: createWaterfallHook<GameLaunchConfig>('play.game.launching')
  }
}
