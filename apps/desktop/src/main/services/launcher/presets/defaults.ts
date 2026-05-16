import { dirname } from 'path'
import type { DbService } from '@main/services/db'
import { games } from '@shared/db'
import { eq } from 'drizzle-orm'
import { createLogger } from '@main/log'

const log = createLogger('Launcher')

/**
 * Apply default launch configuration based on selected file path.
 * Sets launcherPath, gameDirPath, and default modes.
 * @param dbService - The DbService instance
 * @param eventService - The EventService instance
 * @param gameId - The game ID
 * @param filePath - The selected executable file path
 */
export async function applyDefaultLaunchConfig(
  dbService: DbService,
  gameId: string,
  filePath: string
): Promise<void> {
  const gameDirPath = dirname(filePath)

  dbService.client
    .update(games)
    .set({
      launcherPath: filePath,
      launcherMode: 'file',
      gameDirPath,
      monitorMode: 'folder'
      // monitorPath left empty - fallback will derive from gameDirPath
    })
    .where(eq(games.id, gameId))
    .run()

  log.info('Applied default config for game.', { gameId: gameId, filePath: filePath })
}
