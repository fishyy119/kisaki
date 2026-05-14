import type { IpcService } from '@main/services/ipc'
import { wrapIpc, wrapIpcVoid } from '@main/services/ipc'
import type { CropRegion } from '@shared/attachment'
import type { AttachmentInput } from '@shared/db/attachment'
import type { AttachmentService } from './service'
import type { CropToTempOptions } from './crop'

export function registerAttachmentIpc(service: AttachmentService, ipc: IpcService): void {
  ipc.handle('attachment:crop-to-temp', async (_, input, cropRegion: CropRegion, options) =>
    wrapIpc(() =>
      service.cropToTemp(
        input as AttachmentInput,
        cropRegion,
        options as CropToTempOptions | undefined
      )
    )
  )

  ipc.handle('attachment:create-game-backup', async (_, gameId, note) =>
    wrapIpc(() => service.game.createBackup(gameId, note))
  )

  ipc.handle('attachment:delete-game-backup', async (_, gameId, backupAt) =>
    wrapIpcVoid(() => service.game.deleteBackup(gameId, backupAt))
  )

  ipc.handle('attachment:restore-game-backup', async (_, gameId, backupAt) =>
    wrapIpcVoid(() => service.game.restoreBackup(gameId, backupAt))
  )

  ipc.handle('attachment:update-game-backup', async (_, gameId, backupAt, updates) =>
    wrapIpcVoid(() => service.game.updateBackup(gameId, backupAt, updates))
  )

  ipc.handle('attachment:open-backup-folder', async (_, gameId) =>
    wrapIpcVoid(() => service.game.openBackupFolder(gameId))
  )

  ipc.handle('attachment:open-save-folder', async (_, gameId) =>
    wrapIpcVoid(() => service.game.openSaveFolder(gameId))
  )
}
