/**
 * Attachment Service
 *
 * Handles attachment workflows (e.g. crop, save backups).
 *
 * Notes:
 * - Low-level attachment CRUD is provided by DbService.attachment (via db:* IPC).
 * - This service stays focused on workflows that require main-process capabilities.
 */

import { app } from 'electron'
import log from 'electron-log/main'
import path from 'path'
import type { IMediaService, ServiceInitContainer, ServiceName } from '@main/container'
import type { NetworkService } from '@main/services/network'
import type { MediaType } from '@shared/common'
import type { CropRegion } from '@shared/attachment'
import type { AttachmentInput } from '@shared/db/attachment'
import { GameAttachmentHandler } from './handlers/game'
import { AttachmentCropper, type CropToTempOptions } from './crop'
import { registerAttachmentIpc } from './ipc'

export class AttachmentService implements IMediaService {
  readonly id = 'attachment'
  readonly deps = ['db', 'ipc', 'network'] as const satisfies readonly ServiceName[]

  game!: GameAttachmentHandler
  private networkService!: NetworkService
  private cropper!: AttachmentCropper

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const dbService = container.get('db')
    const ipcService = container.get('ipc')

    this.game = new GameAttachmentHandler(dbService)
    this.networkService = container.get('network')
    this.cropper = new AttachmentCropper({
      tempDir: path.join(app.getPath('temp'), 'kisaki', 'crop'),
      downloadBuffer: async (url) => await this.networkService.downloadBuffer(url)
    })
    registerAttachmentIpc(this, ipcService)

    this.cropper.cleanupOldTempCrops(24 * 60 * 60 * 1000).catch((error) => {
      log.warn('[AttachmentService] Failed to cleanup temp crops:', error)
    })
    log.info('[AttachmentService] Initialized')
  }

  cropToTemp(
    input: AttachmentInput,
    cropRegion: CropRegion,
    options?: CropToTempOptions
  ): Promise<string> {
    return this.cropper.cropToTemp(input, cropRegion, options)
  }

  getSupportedMedia(): MediaType[] {
    return ['game']
  }
}
