import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import { registerBackgroundTaskIpc } from './ipc'
import { BackgroundTaskRunner } from './runner'
import { BackgroundTaskScheduler } from './scheduler'
import { BackgroundTaskStore } from './store'

const log = createLogger('BackgroundTask')

export class BackgroundTaskService implements IService {
  readonly id = 'background-task'
  readonly deps = ['db', 'ipc', 'event', 'command'] as const satisfies readonly ServiceName[]

  store!: BackgroundTaskStore
  runner!: BackgroundTaskRunner

  private scheduler!: BackgroundTaskScheduler
  private unsubscribeAppReady: (() => void) | null = null

  async init(container: ServiceInitContainer<this>): Promise<void> {
    this.store = new BackgroundTaskStore({
      db: container.get('db'),
      onTaskChanged: (taskId) => {
        this.scheduler.refresh(taskId)
        container.get('event').bus.emit('background-task:changed', { taskId })
      },
      onTaskDeleted: (taskId) => {
        this.scheduler.clear(taskId)
        container.get('event').bus.emit('background-task:deleted', { taskId })
      }
    })
    this.runner = new BackgroundTaskRunner({
      command: container.get('command'),
      store: this.store,
      clearTaskTimer: (taskId) => this.scheduler.clear(taskId),
      refreshTaskTimer: (taskId) => this.scheduler.refresh(taskId),
      onRunStarted: (event) =>
        container.get('event').bus.emit('background-task:run-started', event),
      onRunFinished: (record) =>
        container.get('event').bus.emit('background-task:run-finished', record)
    })
    this.scheduler = new BackgroundTaskScheduler({
      store: this.store,
      runner: this.runner
    })

    this.store.load()
    registerBackgroundTaskIpc(this, container.get('ipc'))
    this.unsubscribeAppReady = container.get('event').bus.on('app:ready', () => {
      void this.runStartupTasks().catch((error) => {
        log.error('Startup tasks failed:', error)
      })
    })
    this.scheduler.refreshAll()
    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    this.unsubscribeAppReady?.()
    this.unsubscribeAppReady = null
    this.scheduler.dispose()
    this.runner.dispose()
    log.info('Disposed')
  }

  private async runStartupTasks(): Promise<void> {
    for (const taskId of this.store.listStartupTaskIds()) {
      await this.runner.runStartup(taskId).catch((error) => {
        log.error('Startup task failed.', error, { taskId: taskId })
      })
    }
  }
}
