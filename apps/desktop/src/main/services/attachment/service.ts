import { app } from 'electron'
import { createLogger } from '@main/log'
import path from 'node:path'
import type { IMediaService, ServiceInitContainer, ServiceName } from '@main/container'
import type { MediaType } from '@shared/common'
import { AttachmentImages } from './images'
import { GameAttachmentHandler } from './handlers/game'
import { registerAttachmentIpc } from './ipc'

const log = createLogger('Attachment')

/**
 * Main-process composition root for attachment workflows.
 *
 * Low-level attachment CRUD lives on DbService.attachment. This service owns
 * workflows that need main-process capabilities, exposed through submodule
 * namespaces.
 */
export class AttachmentService implements IMediaService {
  readonly id = 'attachment'
  readonly deps = ['db', 'ipc', 'network'] as const satisfies readonly ServiceName[]

  images!: AttachmentImages
  game!: GameAttachmentHandler

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const dbService = container.get('db')
    const ipcService = container.get('ipc')
    const networkService = container.get('network')

    this.images = new AttachmentImages({
      tempDir: path.join(app.getPath('temp'), 'kisaki', 'crop'),
      downloadBuffer: (url) => networkService.download.buffer(url)
    })
    this.game = new GameAttachmentHandler(dbService)
    registerAttachmentIpc(this, ipcService)

    this.images.cleanupOldTempCrops(24 * 60 * 60 * 1000).catch((error) => {
      log.warn('Failed to cleanup temp crops:', error)
    })
    log.info('Initialized')
  }

  getSupportedMedia(): MediaType[] {
    return ['game']
  }
}
