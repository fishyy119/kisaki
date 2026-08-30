export type NotifyMode = 'toast' | 'native' | 'auto'

export type NotificationKind = 'success' | 'info' | 'warning' | 'error' | 'loading'

export interface NotifyOptions {
  message?: string | undefined
  mode?: NotifyMode | undefined
  id?: string | undefined
  closable?: boolean | undefined
}

export interface NotificationHandle {
  id: string
}

export interface NotifyCapability {
  success(title: string, options?: string | NotifyOptions): Promise<NotificationHandle>
  info(title: string, options?: string | NotifyOptions): Promise<NotificationHandle>
  warning(title: string, options?: string | NotifyOptions): Promise<NotificationHandle>
  error(title: string, options?: string | NotifyOptions): Promise<NotificationHandle>
  loading(title: string, options?: string | NotifyOptions): Promise<NotificationHandle>
  update(
    id: string,
    kind: NotificationKind,
    title: string,
    options?: string | NotifyOptions | undefined
  ): Promise<void>
  dismiss(id: string): Promise<void>
}
