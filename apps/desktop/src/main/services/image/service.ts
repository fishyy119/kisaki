/**
 * Image Service
 *
 * Domain-free image transforms backed by sharp: staging transforms for the
 * asset picker (crop to a temp file, downscaled preview) and icon encoding for
 * desktop shortcuts. Knows nothing about entities or attachments; callers hand
 * it a source and receive bytes or a temp path.
 */

import { app } from 'electron'
import path from 'node:path'
import { createLogger } from '@main/log'
import type { INonDomainService, ServiceInitContainer } from '@main/container'
import { ImageIcons } from './icons'
import { registerImageIpc } from './ipc'
import { ImageStaging } from './staging'

const log = createLogger('Image')

const STAGING_TEMP_TTL_MS = 24 * 60 * 60 * 1000

export class ImageService implements INonDomainService<'image'> {
  readonly id = 'image'
  readonly deps = ['ipc', 'network'] as const

  staging!: ImageStaging
  icons!: ImageIcons

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const network = container.get('network')
    const downloadBuffer = (url: string) => network.download.buffer(url)

    this.staging = new ImageStaging({
      tempDir: path.join(app.getPath('temp'), 'kisaki', 'crop'),
      downloadBuffer
    })
    this.icons = new ImageIcons({ downloadBuffer })
    registerImageIpc(this, container.get('ipc'))

    this.staging.cleanupOldTemp(STAGING_TEMP_TTL_MS).catch((error) => {
      log.warn('Failed to cleanup staged image temp files.', error)
    })
    log.info('Initialized')
  }
}
