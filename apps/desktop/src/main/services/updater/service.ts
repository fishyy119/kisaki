/**
 * Updater Service
 *
 * Wires updater capabilities into the service container lifecycle.
 */

import { createLogger } from '@main/log'
import type { INonDomainService, ServiceInitContainer } from '@main/container'
import { registerUpdaterIpc } from './ipc'
import { UpdaterChangelogProvider } from './changelog'
import { UpdaterSettings } from './preferences'
import { AppUpdateManager } from './manager'

const log = createLogger('Updater')

export class UpdaterService implements INonDomainService<'updater'> {
  readonly id = 'updater'
  readonly deps = [
    'db',
    'i18n',
    'ipc',
    'network',
    'task-run'
  ] as const

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
      taskRun: container.get('task-run'),
      i18n: container.get('i18n')
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
