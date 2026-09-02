import type { IpcService } from '@main/services/ipc'
import { wrapIpc, wrapIpcVoid } from '@main/services/ipc'
import type { AttachmentService } from './service'

export function registerAttachmentIpc(service: AttachmentService, ipc: IpcService): void {
  ipc.handle('attachment:create-launch-shortcut', async (_, mediaType, entityId) =>
    wrapIpc(() => service.shortcuts.createLaunchShortcut(mediaType, entityId))
  )

  ipc.handle('attachment:create-game-save-backup', async (_, gameId, note) =>
    wrapIpc(() => service.game.saves.createBackup(gameId, note))
  )

  ipc.handle('attachment:delete-game-save-backup', async (_, gameId, backupAt) =>
    wrapIpcVoid(() => service.game.saves.deleteBackup(gameId, backupAt))
  )

  ipc.handle('attachment:restore-game-save-backup', async (_, gameId, backupAt) =>
    wrapIpcVoid(() => service.game.saves.restoreBackup(gameId, backupAt))
  )

  ipc.handle('attachment:update-game-save-backup', async (_, gameId, backupAt, updates) =>
    wrapIpcVoid(() => service.game.saves.updateBackup(gameId, backupAt, updates))
  )

  ipc.handle('attachment:open-save-backup-folder', async (_, gameId) =>
    wrapIpcVoid(() => service.game.saves.openBackupFolder(gameId))
  )

  ipc.handle('attachment:open-save-folder', async (_, gameId) =>
    wrapIpcVoid(() => service.game.saves.openSaveFolder(gameId))
  )
}
