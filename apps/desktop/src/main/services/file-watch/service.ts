/**
 * File Watch Service
 *
 * Technical service for watching filesystem paths: it reports what changed under
 * a set of roots and knows nothing about scanners, library rows, or extensions.
 * Consumers own a scope, decide which events matter, and act on them.
 */

import { createLogger } from '@main/log'
import type { IService, ServiceName } from '@main/container'
import { FileWatchScope, type FileWatchOptions } from './scope'

const log = createLogger('Watch')

export class FileWatchService implements IService<'file-watch'> {
  readonly id = 'file-watch'
  readonly deps = [] as const satisfies readonly ServiceName[]

  private readonly scopes = new Set<FileWatchScope>()

  async init(): Promise<void> {
    log.info('Initialized')
  }

  /** Starts watching; the caller owns the scope and closes it when done. */
  watch(options: FileWatchOptions): FileWatchScope {
    const scope: FileWatchScope = new FileWatchScope(options, () => {
      this.scopes.delete(scope)
    })
    this.scopes.add(scope)
    return scope
  }

  async dispose(): Promise<void> {
    // Scopes deregister themselves as they close, so iterate a snapshot.
    await Promise.all([...this.scopes].map((scope) => scope.close()))
    this.scopes.clear()
    log.info('Disposed')
  }
}
