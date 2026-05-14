import type { IpcService } from '@main/services/ipc'
import { wrapIpc, wrapIpcVoid } from '@main/services/ipc'
import type { DbService } from './service'

export function registerDbIpc(service: DbService, ipc: IpcService): void {
  ipc.handle('db:execute', async (_, sqlstr, params, method) =>
    wrapIpc(() => service.execute(sqlstr, params, method))
  )

  ipc.handle('db:rebuild-fts', async (_, entityType) =>
    wrapIpcVoid(() => service.fts.rebuild(entityType))
  )

  ipc.handle('db:rebuild-all-fts', async () => wrapIpcVoid(() => service.fts.rebuildAll()))

  ipc.handle('db:preview-entity-delete', async (_, params) =>
    wrapIpc(() => service.helper.previewEntityDelete(params))
  )

  ipc.handle('db:delete-entities', async (_, params) =>
    wrapIpc(() => service.helper.deleteEntities(params))
  )

  ipc.handle('db:attachment-set-file', async (_, tableName, rowId, field, input) =>
    wrapIpc(() => service.attachment.setFileByTableName(tableName, rowId, field, input))
  )

  ipc.handle('db:attachment-clear-file', async (_, tableName, rowId, field) =>
    wrapIpcVoid(() => service.attachment.clearFileByTableName(tableName, rowId, field))
  )

  ipc.handle('db:attachment-add-file', async (_, tableName, rowId, field, input) =>
    wrapIpc(() => service.attachment.addFileByTableName(tableName, rowId, field, input))
  )

  ipc.handle('db:attachment-remove-file', async (_, tableName, rowId, field, fileName) =>
    wrapIpcVoid(() => service.attachment.removeFileByTableName(tableName, rowId, field, fileName))
  )

  ipc.handle('db:attachment-list-files', async (_, tableName, rowId, field) =>
    wrapIpc(() => service.attachment.listFilesByTableName(tableName, rowId, field))
  )

  ipc.handle('db:attachment-clear-files', async (_, tableName, rowId, field) =>
    wrapIpcVoid(() => service.attachment.clearFilesByTableName(tableName, rowId, field))
  )

  ipc.handle('db:attachment-cleanup-row', async (_, tableName, rowId) =>
    wrapIpcVoid(() => service.attachment.cleanupRow(tableName, rowId))
  )

  ipc.handle('db:attachment-get-path', async (_, tableName, rowId, fileName) =>
    wrapIpc(() => service.attachment.getPath(tableName, rowId, fileName))
  )
}
