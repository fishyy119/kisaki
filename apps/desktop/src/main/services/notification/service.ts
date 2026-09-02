/**
 * Notify Service
 *
 * Cross-process notification with native notification support.
 */

import { Notification } from 'electron'
import { newId } from '@shared/id'
import { createLogger } from '@main/log'
import type { INonDomainService, ServiceInitContainer } from '@main/container'
import type { IpcService } from '@main/services/ipc'
import type { WindowService } from '@main/services/window'
import type { NotifyOptions } from '@shared/notification'
import { registerNotificationIpc } from './ipc'

const log = createLogger('Notification')

export type NotifyActionHandler = () => void | Promise<void>
export type NotifyActionHandlers = Record<string, NotifyActionHandler>
export type NotifyCloseHandler = () => void | Promise<void>

export interface NotifyCallbacks {
  actions?: NotifyActionHandlers
  onClose?: NotifyCloseHandler
}

export class NotificationService implements INonDomainService<'notification'> {
  readonly id = 'notification'
  readonly deps = ['ipc', 'window'] as const

  private ipcService!: IpcService
  private windowService!: WindowService
  private readonly actionHandlers = new Map<string, Map<string, NotifyActionHandler>>()
  private readonly closeHandlers = new Map<string, NotifyCloseHandler>()

  async init(container: ServiceInitContainer<this>): Promise<void> {
    this.ipcService = container.get('ipc')
    this.windowService = container.get('window')

    registerNotificationIpc(this, this.ipcService)
    log.info('Initialized')
  }

  show(options: NotifyOptions, toastId?: string, callbacks?: NotifyCallbacks): string | undefined {
    const target = options.target ?? 'toast'

    switch (target) {
      case 'native':
        this.showNative(options)
        return undefined
      case 'auto':
        return this.showAuto(options, toastId, callbacks)
      case 'toast':
      default:
        return this.forwardToRenderer(options, toastId, callbacks)
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
    callbacks?: NotifyCallbacks
  ): string | undefined {
    const isFocused = this.windowService.mainWindow.isFocused()
    if (isFocused) {
      return this.forwardToRenderer(options, toastId, callbacks)
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
    callbacks?: NotifyCallbacks
  ): string {
    const resolvedToastId = toastId ?? newId()
    this.trackCallbacks(resolvedToastId, options, callbacks)
    this.ipcService.send('notification:show', { ...options, toastId: resolvedToastId })
    return resolvedToastId
  }

  loading(title: string, message?: string): string {
    const toastId = newId()
    this.ipcService.send('notification:loading', { toastId, title, message })
    return toastId
  }

  update(toastId: string, options: NotifyOptions, callbacks?: NotifyCallbacks): void {
    this.trackCallbacks(toastId, options, callbacks)
    this.ipcService.send('notification:update', { toastId, ...options })
  }

  dismiss(toastId?: string): void {
    if (toastId) {
      this.actionHandlers.delete(toastId)
      this.closeHandlers.delete(toastId)
    } else {
      this.actionHandlers.clear()
      this.closeHandlers.clear()
    }
    this.ipcService.send('notification:dismiss', { toastId })
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

  handleClosed(toastId: string): void {
    const handler = this.closeHandlers.get(toastId)
    this.actionHandlers.delete(toastId)
    this.closeHandlers.delete(toastId)
    if (!handler) {
      return
    }

    void Promise.resolve()
      .then(() => handler())
      .catch((error) => {
        log.warn('Notification close callback failed.', error)
      })
  }

  private trackCallbacks(
    toastId: string,
    options: NotifyOptions,
    callbacks?: NotifyCallbacks
  ): void {
    if (!options.action) {
      this.actionHandlers.delete(toastId)
    } else {
      const handler = callbacks?.actions?.[options.action.id]
      if (!handler) {
        this.actionHandlers.delete(toastId)
      } else {
        this.actionHandlers.set(toastId, new Map([[options.action.id, handler]]))
      }
    }

    if (callbacks?.onClose) {
      this.closeHandlers.set(toastId, callbacks.onClose)
    } else {
      this.closeHandlers.delete(toastId)
    }
  }
}
