import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import { registerAutomationIpc } from './ipc'
import { AutomationHistoryStore } from './history/store'
import { AutomationRunner } from './runner'
import { AutomationScheduler } from './scheduler'
import { AutomationStore } from './store'

const log = createLogger('Automation')

export class AutomationService implements IService {
  readonly id = 'automation'
  readonly deps = ['db', 'ipc', 'event', 'command'] as const satisfies readonly ServiceName[]

  store!: AutomationStore
  history!: AutomationHistoryStore
  runner!: AutomationRunner

  private scheduler!: AutomationScheduler
  private unsubscribeAppReady: (() => void) | null = null

  async init(container: ServiceInitContainer<this>): Promise<void> {
    this.history = new AutomationHistoryStore({
      db: container.get('db')
    })
    this.store = new AutomationStore({
      db: container.get('db'),
      history: this.history,
      onAutomationChanged: (automationId) => {
        this.scheduler.refresh(automationId)
        container.get('event').bus.emit('automation.changed', { automationId })
      },
      onAutomationDeleted: (automationId) => {
        this.scheduler.clear(automationId)
        container.get('event').bus.emit('automation.deleted', { automationId })
      }
    })
    this.runner = new AutomationRunner({
      command: container.get('command'),
      store: this.store,
      clearAutomationTimer: (automationId) => this.scheduler.clear(automationId),
      refreshAutomationTimer: (automationId) => this.scheduler.refresh(automationId),
      onRunStarted: (event) => container.get('event').bus.emit('automation.started', event),
      onRunFinished: (record) => container.get('event').bus.emit('automation.finished', record)
    })
    this.scheduler = new AutomationScheduler({
      store: this.store,
      runner: this.runner
    })

    this.store.load()
    registerAutomationIpc(this, container.get('ipc'))
    this.unsubscribeAppReady = container.get('event').bus.on('app.ready', () => {
      void this.runStartupAutomations().catch((error) => {
        log.error('Startup automations failed:', error)
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

  private async runStartupAutomations(): Promise<void> {
    for (const automationId of this.store.listStartupAutomationIds()) {
      await this.runner.runStartup(automationId).catch((error) => {
        log.error('Startup automation failed.', error, { automationId })
      })
    }
  }
}
