import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import type { IpcService } from '@main/services/ipc'
import { TaskRunHistoryStore } from './history/store'
import { registerTaskRunIpc } from './ipc'
import { TaskRunNotificationCoordinator } from './notifications'
import { TaskRunManager } from './runs/manager'

const log = createLogger('TaskRun')

export class TaskRunService implements IService {
  readonly id = 'task-run'
  readonly deps = ['db', 'ipc', 'notify'] as const satisfies readonly ServiceName[]

  runs!: TaskRunManager
  history!: TaskRunHistoryStore

  private ipc!: IpcService
  private notifications!: TaskRunNotificationCoordinator

  async init(container: ServiceInitContainer<this>): Promise<void> {
    this.ipc = container.get('ipc')
    this.history = new TaskRunHistoryStore(container.get('db').client, {
      onDeleted: (runIds) => this.emitDeleted(runIds)
    })
    this.notifications = new TaskRunNotificationCoordinator({
      notify: container.get('notify'),
      cancelRun: (runId) => this.runs.cancel(runId)
    })
    this.runs = new TaskRunManager({
      ipc: this.ipc,
      history: this.history,
      notifications: this.notifications
    })

    registerTaskRunIpc(this, this.ipc)
    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    await this.runs.dispose()
    this.notifications.dispose()
    log.info('Disposed')
  }

  private emitDeleted(runIds: readonly string[]): void {
    for (const runId of runIds) {
      this.ipc.send('task-run:deleted', { runId })
    }
  }
}
