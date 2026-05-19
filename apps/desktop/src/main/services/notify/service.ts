/**
 * Notify Service
 *
 * Cross-process notification with native notification support.
 */

import { Notification } from 'electron'
import { nanoid } from 'nanoid'
import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import type { IpcService } from '@main/services/ipc'
import type { WindowService } from '@main/services/window'
import type { NotifyOptions } from '@shared/notify'
import { registerNotifyIpc } from './ipc'

const log = createLogger('Notify')

export type NotifyActionHandler = () => void | Promise<void>
export type NotifyActionHandlers = Record<string, NotifyActionHandler>

export class NotifyService implements IService {
  readonly id = 'notify'
  readonly deps = ['ipc', 'window'] as const satisfies readonly ServiceName[]

  private ipcService!: IpcService
  private windowService!: WindowService
  private readonly actionHandlers = new Map<string, Map<string, NotifyActionHandler>>()

  async init(container: ServiceInitContainer<this>): Promise<void> {
    this.ipcService = container.get('ipc')
    this.windowService = container.get('window')

    registerNotifyIpc(this, this.ipcService)
    log.info('Initialized')
  }

  show(
    options: NotifyOptions,
    toastId?: string,
    actionHandlers?: NotifyActionHandlers
  ): string | undefined {
    const target = options.target ?? 'toast'

    switch (target) {
      case 'native':
        this.showNative(options)
        return undefined
      case 'auto':
        return this.showAuto(options, toastId, actionHandlers)
      case 'toast':
      default:
        return this.forwardToRenderer(options, toastId, actionHandlers)
    }
  }

  success(title: string, message?: string): void {
    this.show({ title, message, type: 'success' })
  }

  error(title: string, message?: string): void {
    this.show({ title, message, type: 'error' })
  }

  warning(title: string, message?: string): void {
    this.show({ title, message, type: 'warning' })
  }

  info(title: string, message?: string): void {
    this.show({ title, message, type: 'info' })
  }

  showAuto(
    options: NotifyOptions,
    toastId?: string,
    actionHandlers?: NotifyActionHandlers
  ): string | undefined {
    const isFocused = this.windowService.mainWindow.isFocused()
    if (isFocused) {
      return this.forwardToRenderer(options, toastId, actionHandlers)
    } else {
      this.showNative(options)
      return undefined
    }
  }

  showNative(options: NotifyOptions): void {
    const notification = new Notification({
      title: options.title,
      body: options.message
    })
    notification.show()
  }

  private forwardToRenderer(
    options: NotifyOptions,
    toastId?: string,
    actionHandlers?: NotifyActionHandlers
  ): string {
    const resolvedToastId = toastId ?? nanoid()
    this.trackActionHandlers(resolvedToastId, options, actionHandlers)
    this.ipcService.send('notify:show', { ...options, toastId: resolvedToastId })
    return resolvedToastId
  }

  loading(title: string, message?: string): string {
    const toastId = nanoid()
    this.ipcService.send('notify:loading', { toastId, title, message })
    return toastId
  }

  update(toastId: string, options: NotifyOptions, actionHandlers?: NotifyActionHandlers): void {
    this.trackActionHandlers(toastId, options, actionHandlers)
    this.ipcService.send('notify:update', { toastId, ...options })
  }

  dismiss(toastId?: string): void {
    if (toastId) {
      this.actionHandlers.delete(toastId)
    } else {
      this.actionHandlers.clear()
    }
    this.ipcService.send('notify:dismiss', { toastId })
  }

  handleAction(toastId: string, actionId: string): void {
    const handler = this.actionHandlers.get(toastId)?.get(actionId)
    if (!handler) {
      return
    }

    void Promise.resolve()
      .then(() => handler())
      .catch((error) => {
        log.warn('Notification action failed.', error)
      })
  }

  private trackActionHandlers(
    toastId: string,
    options: NotifyOptions,
    actionHandlers?: NotifyActionHandlers
  ): void {
    if (!options.action) {
      this.actionHandlers.delete(toastId)
      return
    }

    const handler = actionHandlers?.[options.action.id]
    if (!handler) {
      this.actionHandlers.delete(toastId)
      return
    }

    this.actionHandlers.set(toastId, new Map([[options.action.id, handler]]))
  }
}
