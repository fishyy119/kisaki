/**
 * Attachment Service
 *
 * Workflows that produce or consume row-attached files with main-process
 * capabilities: game save backups, launcher-icon derivation, and desktop launch
 * shortcuts. The mechanism itself — layout, column binding, row-lifetime
 * cleanup, merge staging, the `attachment://` protocol — is the attachment
 * store (`db.attachment`); this service composes workflows on top of it.
 */

import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import { GameLauncherIcon } from './game/launcher-icon'
import { GameSaves } from './game/saves'
import { registerAttachmentIpc } from './ipc'
import { AttachmentShortcuts } from './shortcuts'

const log = createLogger('Attachment')

/** Game-only attachment workflows; only games have executables and saves. */
export interface GameAttachments {
  saves: GameSaves
  launcherIcon: GameLauncherIcon
}

export class AttachmentService implements IService<'attachment'> {
  readonly id = 'attachment'
  readonly deps = ['db', 'ipc', 'image', 'native'] as const satisfies readonly ServiceName[]

  shortcuts!: AttachmentShortcuts
  game!: GameAttachments

  private untapDbChanged?: () => void

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const db = container.get('db')

    this.shortcuts = new AttachmentShortcuts({
      db,
      image: container.get('image'),
      native: container.get('native')
    })
    this.game = {
      saves: new GameSaves(db),
      launcherIcon: new GameLauncherIcon(db)
    }

    // Derived state reacts to committed rows: launcher icons fill from any
    // writer of the launcher path, and cached shortcut icons follow row deletion.
    this.untapDbChanged = db.hooks.dbChanged.tap(({ changes }) => {
      for (const change of changes) {
        if (change.table === 'games') {
          this.game.launcherIcon.onGameChanged(change).catch((error) => {
            log.warn('Launcher icon derivation failed.', error, { gameId: change.id })
          })
        }
        if (change.operation === 'deleted') {
          this.shortcuts.onRowDeleted(change.table, change.id).catch((error) => {
            log.warn('Shortcut icon cache cleanup failed.', error, {
              table: change.table,
              id: change.id
            })
          })
        }
      }
    })

    registerAttachmentIpc(this, container.get('ipc'))
    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    this.untapDbChanged?.()
    this.untapDbChanged = undefined
  }
}
