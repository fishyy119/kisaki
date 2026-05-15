/**
 * Notify Service
 *
 * Cross-process notification with native notification support.
 * Provides identical API to renderer process notify manager.
 */

import { Notification } from 'electron'
import { nanoid } from 'nanoid'
import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import type { IpcService } from '@main/services/ipc'
import type { WindowService } from '@main/services/window'
import type { NotifyOptions, NotifyFunction } from '@shared/notify'
import { registerNotifyIpc } from './ipc'

const log = createLogger('Notify')

export class NotifyService implements IService {
  readonly id = 'notify'
  readonly deps = ['ipc', 'window'] as const satisfies readonly ServiceName[]

  private ipcService!: IpcService
  private windowService!: WindowService
  private _notify!: NotifyFunction

  async init(container: ServiceInitContainer<this>): Promise<void> {
    this.ipcService = container.get('ipc')
    this.windowService = container.get('window')

    registerNotifyIpc(this, this.ipcService)
    this._notify = this.createNotify()
    log.info('Initialized')
  }

  /**
   * Get the notify function for use in services
   */
  get notify(): NotifyFunction {
    return this._notify
  }

  showWithHandle(options: NotifyOptions, toastId?: string): string | undefined {
    return this.handleNotify(options, toastId)
  }

  /**
   * Create the notify function with methods
   */
  private createNotify(): NotifyFunction {
    const notifyFn = ((options: NotifyOptions) => {
      this.handleNotify(options)
    }) as NotifyFunction

    notifyFn.success = (title, message?) => this.handleNotify({ title, message, type: 'success' })
    notifyFn.error = (title, message?) => this.handleNotify({ title, message, type: 'error' })
    notifyFn.warning = (title, message?) => this.handleNotify({ title, message, type: 'warning' })
    notifyFn.info = (title, message?) => this.handleNotify({ title, message, type: 'info' })

    notifyFn.loading = (title, message?) => this.showLoading(title, message)
    notifyFn.update = (toastId, options) => this.updateToast(toastId, options)
    notifyFn.dismiss = (toastId?) => this.dismissToast(toastId)

    return notifyFn
  }

  /**
   * Main notify entry point
   */
  private handleNotify(options: NotifyOptions, toastId?: string): string | undefined {
    const target = options.target ?? 'toast'

    switch (target) {
      case 'native':
        this.showNative(options)
        return undefined
      case 'auto':
        return this.handleAuto(options, toastId)
      case 'toast':
      default:
        return this.forwardToRenderer(options, toastId)
    }
  }

  handleAuto(options: NotifyOptions, toastId?: string): string | undefined {
    const isFocused = this.windowService.isMainWindowFocused()
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

  private showLoading(title: string, message?: string): string {
    const toastId = nanoid()
    this.ipcService.send('notify:loading', { toastId, title, message })
    return toastId
  }

  private updateToast(toastId: string, options: NotifyOptions): void {
    this.ipcService.send('notify:update', { toastId, ...options })
  }

  private dismissToast(toastId?: string): void {
    this.ipcService.send('notify:dismiss', { toastId })
  }
}
