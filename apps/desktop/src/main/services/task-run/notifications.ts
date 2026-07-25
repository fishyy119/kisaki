import type { NotifyOptions, NotifyType } from '@shared/notify'
import type { NotifyCallbacks, NotifyService } from '@main/services/notify'
import type { I18nService } from '@main/services/i18n'
import type { Messages } from '@shared/i18n'
import type { TaskRun, TaskRunPresentation } from '@shared/task-run'

const CANCEL_ACTION_ID = 'cancel'

interface ActiveTaskRunNotification {
  toastId: string
  closed: boolean
}

export interface TaskRunNotificationCoordinatorOptions {
  notify: NotifyService
  i18n: I18nService
  cancelRun(runId: string): boolean
}

export class TaskRunNotificationCoordinator {
  private readonly active = new Map<string, ActiveTaskRunNotification>()

  constructor(private readonly options: TaskRunNotificationCoordinatorOptions) {}

  handleChanged(run: TaskRun, presentation?: TaskRunPresentation): void {
    if (!presentation?.notify?.enabled) {
      return
    }

    if (isFinalStatus(run.status)) {
      this.handleFinal(run, presentation)
      return
    }

    this.handleActive(run, presentation)
  }

  dispose(): void {
    for (const active of this.active.values()) {
      this.options.notify.dismiss(active.toastId)
    }
    this.active.clear()
  }

  private handleActive(run: TaskRun, presentation: TaskRunPresentation): void {
    const notify = presentation.notify
    if (!notify?.enabled) {
      return
    }

    const active = this.active.get(run.id) ?? {
      toastId: `task-run.${run.id}`,
      closed: false
    }

    if (active.closed) {
      this.active.set(run.id, active)
      return
    }

    const options: NotifyOptions = {
      title: notify.title ?? run.title,
      message: formatActiveMessage(this.options.i18n.messages, run, presentation),
      type: 'loading',
      closable: notify.closable ?? true,
      action: createCancelAction(this.options.i18n.messages, run)
    }
    const callbacks: NotifyCallbacks = {
      actions: options.action
        ? {
            [CANCEL_ACTION_ID]: () => this.requestCancel(run, active.toastId)
          }
        : undefined,
      onClose: () => {
        const latest = this.active.get(run.id)
        if (latest) {
          latest.closed = true
        }
      }
    }

    if (this.active.has(run.id)) {
      this.options.notify.update(active.toastId, options, callbacks)
    } else {
      this.options.notify.show(options, active.toastId, callbacks)
      this.active.set(run.id, active)
    }
  }

  private handleFinal(run: TaskRun, presentation: TaskRunPresentation): void {
    const notify = presentation.notify
    if (!notify?.enabled) {
      return
    }

    const active = this.active.get(run.id)
    const resultToastId = `task-run.result.${run.id}`
    const options: NotifyOptions = {
      title: resolveFinalTitle(this.options.i18n.messages, run, presentation),
      message: resolveFinalMessage(run),
      type: resolveFinalType(run),
      closable: true
    }

    if (active && !active.closed) {
      // A progress toast is persistent; the final state needs a fresh toast lifetime.
      this.options.notify.dismiss(active.toastId)
      this.options.notify.show(options, resultToastId)
      this.active.delete(run.id)
      return
    }

    this.active.delete(run.id)
    if (notify.showResult === true) {
      this.options.notify.show(options, resultToastId)
    }
  }

  private requestCancel(run: TaskRun, toastId: string): void {
    const messages = this.options.i18n.messages
    const accepted = this.options.cancelRun(run.id)
    if (!accepted) {
      this.options.notify.update(toastId, {
        title: run.title,
        message: messages.task.notifications.cancelUnavailable,
        type: 'info',
        closable: true
      })
      return
    }

    if (run.status === 'queued') {
      return
    }

    this.options.notify.update(toastId, {
      title: run.title,
      message: messages.task.notifications.cancelling,
      type: 'loading',
      closable: true
    })
  }
}

function createCancelAction(messages: Messages, run: TaskRun): NotifyOptions['action'] {
  if (!run.controls.cancelable || run.status === 'cancelling') {
    return undefined
  }

  return {
    id: CANCEL_ACTION_ID,
    label: messages.common.cancel
  }
}

function formatActiveMessage(
  messages: Messages,
  run: TaskRun,
  presentation: TaskRunPresentation
): string | undefined {
  const notify = presentation.notify
  if (run.status === 'cancelling') {
    return messages.task.notifications.cancelling
  }
  if (run.status === 'pausing') {
    return messages.task.notifications.pausing
  }
  if (run.status === 'paused') {
    return messages.task.notifications.paused
  }

  const base = notify?.message ?? run.progress?.phase?.label ?? run.description
  if (notify?.showProgress === false || !run.progress) {
    return base
  }

  const count = formatProgressCount(run)
  const percent =
    run.progress.work?.percent === undefined
      ? undefined
      : `${Math.round(run.progress.work.percent)}%`
  const suffix = [count, percent].filter(Boolean).join(' ')
  return suffix ? [base, suffix].filter(Boolean).join(' ') : base
}

function formatProgressCount(run: TaskRun): string | undefined {
  const current = run.progress?.work?.current
  const total = run.progress?.work?.total
  if (current === undefined && total === undefined) {
    return undefined
  }

  if (current !== undefined && total !== undefined) {
    return `(${current}/${total})`
  }

  if (current !== undefined) {
    return `(${current})`
  }

  return undefined
}

function resolveFinalTitle(
  messages: Messages,
  run: TaskRun,
  presentation: TaskRunPresentation
): string {
  const title = presentation.notify?.title ?? run.result?.title ?? run.title
  switch (run.status) {
    case 'completed':
      return messages.task.notifications.finalCompleted({ title })
    case 'cancelled':
      return messages.task.notifications.finalCancelled({ title })
    case 'failed':
      return messages.task.notifications.finalFailed({ title })
    default:
      return title
  }
}

function resolveFinalMessage(run: TaskRun): string | undefined {
  return run.result?.summary ?? run.result?.error ?? run.progress?.phase?.label ?? run.description
}

function resolveFinalType(run: TaskRun): NotifyType {
  switch (run.status) {
    case 'completed':
      return 'success'
    case 'cancelled':
      return 'warning'
    case 'failed':
      return 'error'
    default:
      return 'info'
  }
}

function isFinalStatus(status: TaskRun['status']): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}
