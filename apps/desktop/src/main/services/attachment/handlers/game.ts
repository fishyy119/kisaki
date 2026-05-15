/**
 * Game Attachment Handler
 *
 * Attachment workflows for games:
 * - Save backups: create / restore / delete / update / open folders
 *
 * Low-level attachment CRUD is handled by DbService.attachment (AttachmentStore).
 */

import { nanoid } from 'nanoid'
import path from 'path'
import { games } from '@shared/db'
import { shell } from 'electron'
import { compressDir, extractZip } from '@main/utils/archive'
import fse from 'fs-extra'
import { createLogger } from '@main/log'
import { eq } from 'drizzle-orm'
import type { DbService } from '@main/services/db'
import type { SaveBackup } from '@shared/db/json-types'

const log = createLogger('Attachment')

export class GameAttachmentHandler {
  constructor(private dbService: DbService) {}

  // ===========================================================================
  // Save Backups
  // ===========================================================================

  async createBackup(gameId: string, note: string = ''): Promise<SaveBackup> {
    const game = await this.getGame(gameId)

    if (!game.savePath) {
      throw new Error('Save path is not configured for this game')
    }

    if (!(await fse.pathExists(game.savePath))) {
      throw new Error(`Save directory not found: ${game.savePath}`)
    }

    const backupAt = Date.now()
    const fileId = nanoid()
    const saveFile = `${fileId}.zip`

    const outputPath = this.dbService.attachment.getPath('games', gameId, saveFile)
    await fse.ensureDir(path.dirname(outputPath))

    const sizeBytes = await compressDir(game.savePath, outputPath)

    const newBackup: SaveBackup = {
      backupAt,
      note,
      locked: false,
      saveFile,
      sizeBytes
    }

    const currentBackups = game.saveBackups || []
    const updatedBackups = [...currentBackups, newBackup]

    this.dbService.db
      .update(games)
      .set({ saveBackups: updatedBackups })
      .where(eq(games.id, gameId))
      .run()

    await this.cleanupExcessBackups(gameId)

    log.info('Created backup for game.', { gameId: gameId, saveFile: saveFile })
    return newBackup
  }

  async deleteBackup(gameId: string, backupAt: number): Promise<void> {
    const game = await this.getGame(gameId)
    const currentBackups = game.saveBackups || []
    const backup = currentBackups.find((b) => b.backupAt === backupAt)

    if (!backup) {
      throw new Error('Backup not found')
    }

    const backupPath = this.dbService.attachment.getPath('games', gameId, backup.saveFile)
    if (await fse.pathExists(backupPath)) {
      await fse.remove(backupPath)
    }

    const updatedBackups = currentBackups.filter((b) => b.backupAt !== backupAt)
    this.dbService.db
      .update(games)
      .set({ saveBackups: updatedBackups })
      .where(eq(games.id, gameId))
      .run()

    log.info('Deleted backup for game.', { gameId: gameId, backupSaveFile: backup.saveFile })
  }

  async restoreBackup(gameId: string, backupAt: number): Promise<void> {
    const game = await this.getGame(gameId)

    if (!game.savePath) {
      throw new Error('Save path is not configured for this game')
    }

    const currentBackups = game.saveBackups || []
    const backup = currentBackups.find((b) => b.backupAt === backupAt)

    if (!backup) {
      throw new Error('Backup not found')
    }

    const backupPath = this.dbService.attachment.getPath('games', gameId, backup.saveFile)
    if (!(await fse.pathExists(backupPath))) {
      throw new Error('Backup file not found on disk')
    }

    await extractZip(backupPath, game.savePath)
    log.info('Restored backup for game.', { gameId: gameId, backupSaveFile: backup.saveFile })
  }

  async updateBackup(
    gameId: string,
    backupAt: number,
    updates: Partial<Pick<SaveBackup, 'note' | 'locked'>>
  ): Promise<void> {
    const game = await this.getGame(gameId)
    const currentBackups = game.saveBackups || []
    const backupIndex = currentBackups.findIndex((b) => b.backupAt === backupAt)

    if (backupIndex === -1) {
      throw new Error('Backup not found')
    }

    const updatedBackup = { ...currentBackups[backupIndex], ...updates }
    const updatedBackups = [...currentBackups]
    updatedBackups[backupIndex] = updatedBackup

    this.dbService.db
      .update(games)
      .set({ saveBackups: updatedBackups })
      .where(eq(games.id, gameId))
      .run()

    log.info('Updated backup for game.', { gameId: gameId, backupAt: backupAt })
  }

  async openBackupFolder(gameId: string): Promise<void> {
    const backupDir = this.dbService.attachment.getPath('games', gameId, '')
    await fse.ensureDir(backupDir)
    shell.openPath(backupDir)
  }

  async openSaveFolder(gameId: string): Promise<void> {
    const game = await this.getGame(gameId)

    if (!game.savePath) {
      throw new Error('Save path is not configured for this game')
    }

    if (!(await fse.pathExists(game.savePath))) {
      throw new Error(`Save directory not found: ${game.savePath}`)
    }

    shell.openPath(game.savePath)
  }

  async tryAutoBackup(gameId: string): Promise<void> {
    try {
      const game = await this.getGame(gameId)

      if (!game.savePath) return
      if (!(await fse.pathExists(game.savePath))) return

      await this.createBackup(gameId)
      log.info('Auto-backup completed for game.', { gameId: gameId })
    } catch (error) {
      log.error('Auto-backup failed for game.', error, { gameId: gameId })
    }
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private async cleanupExcessBackups(gameId: string): Promise<void> {
    const game = await this.getGame(gameId)
    const currentBackups = game.saveBackups || []
    const maxBackups = game.maxSaveBackups

    const lockedBackups = currentBackups.filter((b) => b.locked)
    const unlockedBackups = currentBackups.filter((b) => !b.locked)

    unlockedBackups.sort((a, b) => b.backupAt - a.backupAt)

    const backupsToKeep = unlockedBackups.slice(0, maxBackups)
    const backupsToDelete = unlockedBackups.slice(maxBackups)

    if (backupsToDelete.length === 0) {
      return
    }

    for (const backup of backupsToDelete) {
      const backupPath = this.dbService.attachment.getPath('games', gameId, backup.saveFile)
      if (await fse.pathExists(backupPath)) {
        await fse.remove(backupPath)
      }
    }

    const finalBackups = [...lockedBackups, ...backupsToKeep].sort(
      (a, b) => a.backupAt - b.backupAt
    )

    this.dbService.db
      .update(games)
      .set({ saveBackups: finalBackups })
      .where(eq(games.id, gameId))
      .run()

    log.info('Cleaned up excess backups for game.', {
      backupsToDeleteLength: backupsToDelete.length,
      gameId: gameId
    })
  }

  private getGame(gameId: string) {
    const result = this.dbService.db.select().from(games).where(eq(games.id, gameId)).limit(1).all()

    const game = result[0]
    if (!game) {
      throw new Error(`Game not found: ${gameId}`)
    }

    return game
  }
}
