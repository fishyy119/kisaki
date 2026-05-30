/**
 * Monitor service shared types
 */

import type { GameLauncherMode, GameMonitorMode } from './db/contracts/enums'

/** Game running status */
export interface GameRunningStatus {
  gameId: string
  isRunning: boolean
  isForeground: boolean
  processName?: string
  pid?: number
  exePath?: string
  startTime?: number
}

/** Game monitor path resolution input. */
export interface GameMonitorPathConfig {
  monitorPath: string | null
  monitorMode: GameMonitorMode
  gameDirPath: string | null
  launcherMode: GameLauncherMode
  launcherPath: string | null
}
