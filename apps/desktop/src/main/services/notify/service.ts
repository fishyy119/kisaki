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

export class NotifyService implements IService {
  readonly id = 'notify'
  readonly deps = ['ipc', 'window'] as const satisfies readonly ServiceName[]

  private ipcService!: IpcService
  private windowService!: WindowService

  async init(container: ServiceInitContainer<this>): Promise<void> {
    this.ipcService = container.get('ipc')
    this.windowService = container.get('window')

    registerNotifyIpc(this, this.ipcService)
    log.info('Initialized')
  }

  show(options: NotifyOptions, toastId?: string): string | undefined {
    const target = options.target ?? 'toast'

    switch (target) {
      case 'native':
        this.showNative(options)
        return undefined
      case 'auto':
        return this.showAuto(options, toastId)
      case 'toast':
      default:
        return this.forwardToRenderer(options, toastId)
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

  showAuto(options: NotifyOptions, toastId?: string): string | undefined {
    const isFocused = this.windowService.mainWindow.isFocused()
    if (isFocused) {
      return this.forwardToRenderer(options, toastId)
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

  private forwardToRenderer(options: NotifyOptions, toastId?: string): string {
    const resolvedToastId = toastId ?? nanoid()
    this.ipcService.send('notify:show', { ...options, toastId: resolvedToastId })
    return resolvedToastId
  }

  loading(title: string, message?: string): string {
    const toastId = nanoid()
    this.ipcService.send('notify:loading', { toastId, title, message })
    return toastId
  }

  update(toastId: string, options: NotifyOptions): void {
    this.ipcService.send('notify:update', { toastId, ...options })
  }

  dismiss(toastId?: string): void {
    this.ipcService.send('notify:dismiss', { toastId })
  }
}
