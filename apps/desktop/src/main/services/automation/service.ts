import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import { registerAutomationIpc } from './ipc'
import { AutomationHistoryStore } from './history/store'
import { AutomationRunner } from './runner'
import { AutomationScheduler } from './scheduler'
import { AutomationStore } from './store'

const log = createLogger('Automation')

export class AutomationService implements IService<'automation'> {
  readonly id = 'automation'
  readonly deps = ['db', 'ipc', 'command'] as const satisfies readonly ServiceName[]

  store!: AutomationStore
  history!: AutomationHistoryStore
  runner!: AutomationRunner

  private scheduler!: AutomationScheduler

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const ipc = container.get('ipc')
    this.history = new AutomationHistoryStore({
      db: container.get('db')
    })
    this.store = new AutomationStore({
      db: container.get('db'),
      history: this.history,
      onAutomationChanged: (automationId) => {
        this.scheduler.refresh(automationId)
        ipc.send('automation:changed', { automationId })
      },
      onAutomationDeleted: (automationId) => {
        this.scheduler.clear(automationId)
        ipc.send('automation:deleted', { automationId })
      }
    })
    this.runner = new AutomationRunner({
      command: container.get('command'),
      store: this.store,
      clearAutomationTimer: (automationId) => this.scheduler.clear(automationId),
      refreshAutomationTimer: (automationId) => this.scheduler.refresh(automationId),
      onRunStarted: (event) => ipc.send('automation:run-started', event),
      onRunFinished: (record) => ipc.send('automation:run-finished', record)
    })
    this.scheduler = new AutomationScheduler({
      store: this.store,
      runner: this.runner
    })

    this.store.load()
    registerAutomationIpc(this, ipc)
    this.scheduler.refreshAll()
    log.info('Initialized')
  }

  async dispose(): Promise<void> {
    this.scheduler.dispose()
    this.runner.dispose()
    log.info('Disposed')
  }

  /** Runs all startup-triggered automations; invoked by bootstrap once the app is ready. */
  async runStartupAutomations(): Promise<void> {
    for (const automationId of this.store.listStartupAutomationIds()) {
      await this.runner.runStartup(automationId).catch((error) => {
        log.error('Startup automation failed.', error, { automationId })
      })
    }
  }
}
