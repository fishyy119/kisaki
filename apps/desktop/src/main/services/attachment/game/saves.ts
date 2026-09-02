/**
 * Game save backups.
 *
 * Packs a game's save directory into a zip attached to the game row, restores
 * a backup back onto disk, and keeps the backup list within the configured
 * limit. Only games have save directories, so this namespace is game-only by
 * domain nature. Low-level attachment CRUD is the attachment store
 * (`db.attachment`).
 */

import { shell } from 'electron'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import { compressDir, extractZip } from '@main/utils/archive'
import { pathExists } from '@main/utils/fs'
import { games } from '@shared/db'
import type { SaveBackup } from '@shared/db/contracts/json'
import { newId } from '@shared/id'

const log = createLogger('Attachment')

export class GameSaves {
  constructor(private readonly dbService: DbService) {}

  async createBackup(gameId: string, note: string = ''): Promise<SaveBackup> {
    const game = this.getGame(gameId)

    if (!game.savePath) {
      throw new Error('Save path is not configured for this game')
    }

    if (!(await pathExists(game.savePath))) {
      throw new Error(`Save directory not found: ${game.savePath}`)
    }

    const backupAt = Date.now()
    const saveFile = `${newId()}.zip`

    const outputPath = this.dbService.attachment.getPath('games', gameId, saveFile)
    await mkdir(path.dirname(outputPath), { recursive: true })

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

    this.dbService.client
      .update(games)
      .set({ saveBackups: updatedBackups })
      .where(eq(games.id, gameId))
      .run()

    await this.cleanupExcessBackups(gameId)

    log.info('Created backup for game.', { gameId, saveFile })
    return newBackup
  }

  async deleteBackup(gameId: string, backupAt: number): Promise<void> {
    const game = this.getGame(gameId)
    const currentBackups = game.saveBackups || []
    const backup = currentBackups.find((b) => b.backupAt === backupAt)

    if (!backup) {
      throw new Error('Backup not found')
    }

    const backupPath = this.dbService.attachment.getPath('games', gameId, backup.saveFile)
    if (await pathExists(backupPath)) {
      await rm(backupPath, { recursive: true, force: true })
    }

    const updatedBackups = currentBackups.filter((b) => b.backupAt !== backupAt)
    this.dbService.client
      .update(games)
      .set({ saveBackups: updatedBackups })
      .where(eq(games.id, gameId))
      .run()

    log.info('Deleted backup for game.', { gameId, backupSaveFile: backup.saveFile })
  }

  async restoreBackup(gameId: string, backupAt: number): Promise<void> {
    const game = this.getGame(gameId)

    if (!game.savePath) {
      throw new Error('Save path is not configured for this game')
    }

    const currentBackups = game.saveBackups || []
    const backup = currentBackups.find((b) => b.backupAt === backupAt)

    if (!backup) {
      throw new Error('Backup not found')
    }

    const backupPath = this.dbService.attachment.getPath('games', gameId, backup.saveFile)
    if (!(await pathExists(backupPath))) {
      throw new Error('Backup file not found on disk')
    }

    await extractZip(backupPath, game.savePath)
    log.info('Restored backup for game.', { gameId, backupSaveFile: backup.saveFile })
  }

  async updateBackup(
    gameId: string,
    backupAt: number,
    updates: Partial<Pick<SaveBackup, 'note' | 'locked'>>
  ): Promise<void> {
    const game = this.getGame(gameId)
    const currentBackups = game.saveBackups || []
    const backupIndex = currentBackups.findIndex((b) => b.backupAt === backupAt)

    if (backupIndex === -1) {
      throw new Error('Backup not found')
    }

    const updatedBackup = { ...currentBackups[backupIndex]!, ...updates }
    const updatedBackups = [...currentBackups]
    updatedBackups[backupIndex] = updatedBackup

    this.dbService.client
      .update(games)
      .set({ saveBackups: updatedBackups })
      .where(eq(games.id, gameId))
      .run()

    log.info('Updated backup for game.', { gameId, backupAt })
  }

  async openBackupFolder(gameId: string): Promise<void> {
    const backupDir = this.dbService.attachment.getRowDir('games', gameId)
    await mkdir(backupDir, { recursive: true })
    shell.openPath(backupDir)
  }

  async openSaveFolder(gameId: string): Promise<void> {
    const game = this.getGame(gameId)

    if (!game.savePath) {
      throw new Error('Save path is not configured for this game')
    }

    if (!(await pathExists(game.savePath))) {
      throw new Error(`Save directory not found: ${game.savePath}`)
    }

    shell.openPath(game.savePath)
  }

  async tryAutoBackup(gameId: string): Promise<void> {
    try {
      const game = this.getGame(gameId)

      if (!game.savePath) return
      if (!(await pathExists(game.savePath))) return

      await this.createBackup(gameId)
      log.info('Auto-backup completed for game.', { gameId })
    } catch (error) {
      log.error('Auto-backup failed for game.', error, { gameId })
    }
  }

  private async cleanupExcessBackups(gameId: string): Promise<void> {
    const game = this.getGame(gameId)
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
      if (await pathExists(backupPath)) {
        await rm(backupPath, { recursive: true, force: true })
      }
    }

    const finalBackups = [...lockedBackups, ...backupsToKeep].sort(
      (a, b) => a.backupAt - b.backupAt
    )

    this.dbService.client
      .update(games)
      .set({ saveBackups: finalBackups })
      .where(eq(games.id, gameId))
      .run()

    log.info('Cleaned up excess backups for game.', {
      backupsToDeleteLength: backupsToDelete.length,
      gameId
    })
  }

  private getGame(gameId: string) {
    const game = this.dbService.client.select().from(games).where(eq(games.id, gameId)).get()
    if (!game) {
      throw new Error(`Game not found: ${gameId}`)
    }
    return game
  }
}
