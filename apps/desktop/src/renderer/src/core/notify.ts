/**
 * Renderer process notify manager
 *
 * Provides unified notification API with toast rendering.
 * Adapted for vue-sonner.
 */

import { h } from 'vue'
import { toast, type ExternalToast } from 'vue-sonner'
import { nanoid } from 'nanoid'
import { ipcManager } from './ipc'
import type { NotifyAction, NotifyOptions, NotifyType, NotifyFunction } from '@shared/notify'

const mainToastIds = new Set<string>()
const suppressedClosedToastIds = new Set<string>()
const LoadingToastIcon = () =>
  h('span', {
    class: 'icon-[mdi--loading] size-4 animate-spin text-muted-foreground'
  })

function getToastFn(options: NotifyOptions) {
  switch (resolveToastType(options)) {
    case 'success':
      return toast.success
    case 'error':
      return toast.error
    case 'warning':
      return toast.warning
    case 'loading':
      return toast.loading
    default:
      return toast.info
  }
}

function resolveToastType(options: NotifyOptions): NotifyType | undefined {
  if (options.type === 'loading' && options.closable !== false) {
    return 'info'
  }

  return options.type
}

function createToastAction(
  toastId: string | undefined,
  action: NotifyAction | undefined
): { label: string; onClick(event: MouseEvent): void } | undefined {
  if (!toastId || !action) {
    return undefined
  }

  return {
    label: action.label,
    onClick(event) {
      event.preventDefault()
      ipcManager.send('notify:action', {
        toastId,
        actionId: action.id
      })
    }
  }
}

function createToastOptions(options: NotifyOptions, toastId?: string): ExternalToast {
  return {
    id: toastId,
    description: options.message,
    duration: options.type === 'loading' ? (options.duration ?? Infinity) : options.duration,
    action: createToastAction(toastId, options.action),
    closeButton: options.closable !== false,
    dismissible: options.closable !== false,
    icon: options.type === 'loading' && options.closable !== false ? LoadingToastIcon : undefined,
    onDismiss: toastId ? () => handleMainToastDismissed(toastId) : undefined
  }
}

function createNotify(): NotifyFunction {
  // Initialize IPC listeners for notifications from main process
  ipcManager.on('notify:show', (_, options) => {
    rememberMainToast(options.toastId)
    const toastFn = getToastFn(options)
    toastFn(options.title, createToastOptions(options, options.toastId))
  })

  ipcManager.on('notify:loading', (_, { toastId, title, message }) => {
    rememberMainToast(toastId)
    toast.loading(title, { id: toastId, description: message })
  })

  ipcManager.on('notify:update', (_, { toastId, ...options }) => {
    rememberMainToast(toastId)
    const toastFn = getToastFn(options)
    toastFn(options.title, createToastOptions(options, toastId))
  })

  ipcManager.on('notify:dismiss', (_, { toastId }) => {
    suppressProgrammaticDismiss(toastId)
    toast.dismiss(toastId)
  })

  // Create notify function
  const notifyFn = ((options: NotifyOptions) => {
    const target = options.target ?? 'toast'

    if (target === 'native' || target === 'auto') {
      // Forward to main process for native/auto handling
      ipcManager.send(target === 'native' ? 'notify:native' : 'notify:auto', options)
    } else {
      // Show toast directly
      const toastFn = getToastFn(options)
      toastFn(options.title, createToastOptions(options))
    }
  }) as NotifyFunction

  notifyFn.success = (title, message?) => notifyFn({ title, message, type: 'success' })
  notifyFn.error = (title, message?) => notifyFn({ title, message, type: 'error' })
  notifyFn.warning = (title, message?) => notifyFn({ title, message, type: 'warning' })
  notifyFn.info = (title, message?) => notifyFn({ title, message, type: 'info' })

  notifyFn.loading = (title, message?) => {
    const toastId = nanoid()
    toast.loading(title, { id: toastId, description: message })
    return toastId
  }

  notifyFn.update = (toastId, options) => {
    const toastFn = getToastFn(options)
    toastFn(options.title, createToastOptions(options, toastId))
  }

  notifyFn.dismiss = (toastId?) => {
    toast.dismiss(toastId)
  }

  return notifyFn
}

export const notify = createNotify()

function rememberMainToast(toastId: string | undefined): void {
  if (toastId) {
    mainToastIds.add(toastId)
    suppressedClosedToastIds.delete(toastId)
  }
}

function suppressProgrammaticDismiss(toastId: string | undefined): void {
  if (toastId) {
    suppressedClosedToastIds.add(toastId)
    mainToastIds.delete(toastId)
    return
  }

  for (const id of mainToastIds) {
    suppressedClosedToastIds.add(id)
  }
  mainToastIds.clear()
}

function handleMainToastDismissed(toastId: string): void {
  if (suppressedClosedToastIds.delete(toastId)) {
    return
  }

  if (!mainToastIds.delete(toastId)) {
    return
  }

  ipcManager.send('notify:closed', {
    toastId
  })
}
