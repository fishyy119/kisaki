/**
 * Game launcher icon derivation.
 *
 * A game's `iconFile` slot is filled from its launcher executable when nothing
 * else has filled it: whenever a game row changes, a local launcher target with
 * an empty icon slot has its shell icon read and stored as the attachment. The
 * slot is derived state — only ever filled while empty, never overwriting a
 * user's or a provider's choice — so the reaction is idempotent: the write it
 * makes leaves the slot non-empty and nothing fires again.
 *
 * The trigger is the row change itself, not any particular editor: the launcher
 * path is written from the first-launch picker, the launch config dialog, and
 * extension capabilities alike, and every path benefits.
 */

import { app } from 'electron'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { eq } from 'drizzle-orm'
import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { DbChangeSummary } from '@shared/db/changes'
import { games, type Game } from '@shared/db'

const log = createLogger('Attachment')

export class GameLauncherIcon {
  /** Launcher paths whose icon extraction failed, so unrelated edits do not retry. */
  private readonly failed = new Map<string, string>()

  constructor(private readonly dbService: DbService) {}

  /** Reacts to a committed game row change; a no-op unless the slot is derivable. */
  async onGameChanged(change: DbChangeSummary): Promise<void> {
    if (change.operation === 'deleted') {
      this.failed.delete(change.id)
      return
    }

    const game = this.dbService.client.select().from(games).where(eq(games.id, change.id)).get()
    if (!game || game.iconFile) {
      return
    }

    const target = resolveLauncherTarget(game)
    if (!target || this.failed.get(game.id) === target) {
      return
    }

    await this.derive(game.id, target)
  }

  private async derive(gameId: string, launcherTarget: string): Promise<void> {
    try {
      const icon = await app.getFileIcon(launcherTarget, { size: 'large' })
      if (icon.isEmpty()) {
        this.failed.set(gameId, launcherTarget)
        return
      }

      await this.dbService.attachment.setFile(games, gameId, 'iconFile', {
        kind: 'buffer',
        buffer: new Uint8Array(icon.toPNG())
      })
      this.failed.delete(gameId)
      log.info('Derived game icon from launcher.', { gameId })
    } catch (error) {
      this.failed.set(gameId, launcherTarget)
      log.warn('Failed to derive game icon from launcher.', error, { gameId })
    }
  }
}

/**
 * The local file a game launches, or null when the launcher is a URL, unset, or
 * missing from disk. Relative launcher paths resolve against the game directory.
 */
export function resolveLauncherTarget(
  game: Pick<Game, 'launcherMode' | 'launcherPath' | 'dirPath'>
): string | null {
  if (game.launcherMode === 'url' || !game.launcherPath) {
    return null
  }
  const target = game.dirPath
    ? resolve(game.dirPath, game.launcherPath)
    : resolve(game.launcherPath)
  return existsSync(target) ? target : null
}
