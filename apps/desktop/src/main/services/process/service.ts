/**
 * Process Service
 *
 * Technical service for OS process control: starting and terminating targets
 * (`launch`) and detecting run/foreground state (`watch`). It owns no domain
 * vocabulary and writes no database rows; business services tap its hooks.
 */

import { createLogger } from '@main/log'
import type { INonDomainService } from '@main/container'
import { createProcessHooks } from './hooks'
import { ProcessLauncher } from './launch'
import { ProcessWatcher } from './watch'

const log = createLogger('Process')

export class ProcessService implements INonDomainService<'process'> {
  readonly id = 'process'
  readonly deps = [] as const
  readonly hooks = createProcessHooks()

  readonly launch = new ProcessLauncher()
  readonly watch = new ProcessWatcher(this.hooks)

  async init(): Promise<void> {
    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    await this.watch.dispose()
    log.info('Disposed')
  }
}
