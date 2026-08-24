/**
 * Network Service
 *
 * Main-process composition root for network capabilities.
 */

import { session } from 'electron'
import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import { NetworkDownloader } from './download'
import { NetworkRequestClient } from './request'

const log = createLogger('Network')

export class NetworkService implements IService {
  readonly id = 'network'
  readonly deps = [] as const satisfies readonly ServiceName[]

  readonly request = new NetworkRequestClient()
  readonly download = new NetworkDownloader({ request: this.request })

  async init(_container: ServiceInitContainer<this>): Promise<void> {
    // Explicitly use system proxy. (This is also Electron's default behavior.)
    await session.defaultSession.setProxy({ mode: 'system' })

    log.info('Initialized')
  }
}
