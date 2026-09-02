/**
 * Unified notification type definitions
 *
 * Cross-process notification API with identical interface for main and renderer.
 */

export type NotifyType = 'info' | 'success' | 'warning' | 'error' | 'loading'
export type NotifyTarget = 'toast' | 'native' | 'auto'

export interface NotifyAction {
  id: string
  label: string
}

export interface NotifyOptions {
  title: string
  message?: string | undefined
  type?: NotifyType | undefined
  target?: NotifyTarget | undefined // Default: 'toast'
  duration?: number | undefined // Toast duration in ms
  action?: NotifyAction | undefined
  closable?: boolean | undefined
}

/**
 * Notify function interface
 *
 * Can be called directly or use shortcut methods:
 * - `notify({ title: '...', type: 'success' })` - full options
 * - `notify.success('...', 'message')` - shortcut
 * - `notify.loading('...')` - returns toastId for updating
 */
export interface NotifyFunction {
  (options: NotifyOptions): void

  success(title: string, message?: string): void
  error(title: string, message?: string): void
  warning(title: string, message?: string): void
  info(title: string, message?: string): void

  loading(title: string, message?: string): string
  update(toastId: string, options: NotifyOptions): void
  dismiss(toastId?: string): void
}
