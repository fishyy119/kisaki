import type {
  CommandExecutionProgress,
  CommandExecutionRequest,
  CommandExecutionResult,
  CommandExecutionStartResult,
  CommandNotificationTemplate
} from '@shared/command'
import type { NotifyType } from '@shared/notify'
import type { NotifyActionHandlers, NotifyService } from '@main/services/notify'
import type { RegisteredCommand } from './registry'

const CANCEL_ACTION_ID = 'cancel'

interface ActiveCommandNotification {
  toastId: string
  title: string
  cancelable: boolean
  cancelling: boolean
  template?: CommandNotificationTemplate
  lastMessage?: string
  hasProgress: boolean
}

export interface CommandNotificationCoordinatorOptions {
  notify: NotifyService
  cancelExecution(executionId: string): boolean
}

export class CommandNotificationCoordinator {
  private readonly active = new Map<string, ActiveCommandNotification>()

  constructor(private readonly options: CommandNotificationCoordinatorOptions) {}

  start(
    started: CommandExecutionStartResult,
    command: RegisteredCommand,
    request: CommandExecutionRequest
  ): void {
    const presentation = request.presentation?.notify
    if (!presentation?.enabled) {
      return
    }

    const title =
      presentation.title ?? command.descriptor.notification?.title ?? command.descriptor.title
    const message =
      presentation.message ?? command.descriptor.notification?.startMessage ?? '正在执行...'
    const active: ActiveCommandNotification = {
      toastId: `command.${started.executionId}`,
      title,
      cancelable: started.cancelable && presentation.cancelable !== false,
      cancelling: false,
      template: command.descriptor.notification,
      lastMessage: message,
      hasProgress: false
    }

    this.active.set(started.executionId, active)
    this.options.notify.show(
      {
        title,
        message,
        type: 'loading',
        action: this.createCancelAction(active)
      },
      active.toastId,
      {
        actions: this.createActionHandlers(started.executionId, active)
      }
    )
  }

  reportProgress(progress: CommandExecutionProgress): void {
    const active = this.active.get(progress.executionId)
    if (!active) {
      return
    }

    if (active.cancelling && progress.state !== 'cancelling') {
      return
    }

    active.cancelling = progress.state === 'cancelling'
    active.lastMessage = formatProgressMessage(progress)
    active.hasProgress = true
    this.options.notify.update(
      active.toastId,
      {
        title: active.title,
        message: active.lastMessage,
        type: 'loading',
        action: this.createCancelAction(active)
      },
      {
        actions: this.createActionHandlers(progress.executionId, active)
      }
    )
  }

  finish(result: CommandExecutionResult): void {
    const active = this.active.get(result.executionId)
    if (!active) {
      return
    }

    const status = resolveFinishStatus(result, active)
    this.options.notify.update(active.toastId, {
      title: status.title,
      message: status.message,
      type: status.type
    })
    this.active.delete(result.executionId)
  }

  dispose(): void {
    for (const active of this.active.values()) {
      this.options.notify.dismiss(active.toastId)
    }
    this.active.clear()
  }

  private requestCancel(executionId: string): void {
    const active = this.active.get(executionId)
    if (!active || active.cancelling) {
      return
    }

    active.cancelling = true
    const cancelled = this.options.cancelExecution(executionId)
    active.lastMessage = cancelled ? '正在取消...' : '命令已结束。'
    this.options.notify.update(active.toastId, {
      title: active.title,
      message: active.lastMessage,
      type: cancelled ? 'loading' : 'info'
    })
  }

  private createCancelAction(active: ActiveCommandNotification) {
    if (!active.cancelable || active.cancelling) {
      return undefined
    }

    return {
      id: CANCEL_ACTION_ID,
      label: '取消'
    }
  }

  private createActionHandlers(
    executionId: string,
    active: ActiveCommandNotification
  ): NotifyActionHandlers | undefined {
    if (!this.createCancelAction(active)) {
      return undefined
    }

    return {
      [CANCEL_ACTION_ID]: () => this.requestCancel(executionId)
    }
  }
}

function resolveFinishStatus(
  result: CommandExecutionResult,
  active: ActiveCommandNotification
): {
  title: string
  message: string
  type: NotifyType
} {
  if (result.status === 'completed') {
    return {
      title: active.template?.successTitle ?? `${active.title}已完成`,
      message:
        active.template?.successMessage ??
        (active.hasProgress ? active.lastMessage : undefined) ??
        '命令已完成。',
      type: 'success'
    }
  }

  if (result.status === 'cancelled') {
    return {
      title: active.template?.cancelledTitle ?? `${active.title}已取消`,
      message: active.template?.cancelledMessage ?? '命令已取消。',
      type: 'warning'
    }
  }

  return {
    title: active.template?.failedTitle ?? `${active.title}执行失败`,
    message:
      active.template?.failedMessage ??
      (active.hasProgress ? active.lastMessage : undefined) ??
      result.error ??
      '命令执行失败。',
    type: 'error'
  }
}

function formatProgressMessage(progress: CommandExecutionProgress): string {
  const message = progress.message?.trim() || progress.phase?.trim() || '运行中'
  const count = formatProgressCount(progress)
  return count ? `${message} ${count}` : message
}

function formatProgressCount(progress: CommandExecutionProgress): string {
  if (progress.current === undefined && progress.total === undefined) {
    return ''
  }

  if (progress.current !== undefined && progress.total !== undefined) {
    return `(${progress.current}/${progress.total})`
  }

  if (progress.current !== undefined) {
    return `(${progress.current})`
  }

  return ''
}
