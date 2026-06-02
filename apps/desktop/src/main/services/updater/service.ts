/**
 * Updater Service
 *
 * Wires updater capabilities into the service container lifecycle.
 */

import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import { registerUpdaterIpc } from './ipc'
import { UpdaterChangelogProvider } from './changelog'
import { UpdaterSettings } from './settings'
import { AppUpdateManager } from './updates'

const log = createLogger('Updater')

export class UpdaterService implements IService {
  readonly id = 'updater'
  readonly deps = ['db', 'ipc', 'network', 'task-run'] as const satisfies readonly ServiceName[]

  updates!: AppUpdateManager
  changelog!: UpdaterChangelogProvider
  settings!: UpdaterSettings

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const dbService = container.get('db')
    const ipcService = container.get('ipc')
    const networkService = container.get('network')

    this.settings = new UpdaterSettings(dbService)
    this.updates = new AppUpdateManager({
      ipc: ipcService,
      settings: this.settings,
      taskRun: container.get('task-run')
    })
    this.changelog = new UpdaterChangelogProvider(networkService, {
      baseUrl: getConfiguredChangelogBaseUrl()
    })

    registerUpdaterIpc(this, ipcService)
    this.updates.init()

    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    this.updates.dispose()
    log.info('Disposed')
  }
}

function getConfiguredChangelogBaseUrl(): string | undefined {
  return (
    process.env['KISAKI_CHANGELOG_BASE_URL']?.trim() ||
    import.meta.env.VITE_KISAKI_CHANGELOG_BASE_URL?.trim() ||
    undefined
  )
}
