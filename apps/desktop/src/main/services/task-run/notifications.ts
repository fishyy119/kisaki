import type { NotifyOptions, NotifyType } from '@shared/notify'
import type { NotifyCallbacks, NotifyService } from '@main/services/notify'
import type { TaskRun, TaskRunPresentation } from '@shared/task-run'

const CANCEL_ACTION_ID = 'cancel'

interface ActiveTaskRunNotification {
  toastId: string
  closed: boolean
}

export interface TaskRunNotificationCoordinatorOptions {
  notify: NotifyService
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
      message: formatActiveMessage(run, presentation),
      type: 'loading',
      closable: notify.closable ?? true,
      action: createCancelAction(run)
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
    const options: NotifyOptions = {
      title: resolveFinalTitle(run, presentation),
      message: resolveFinalMessage(run),
      type: resolveFinalType(run),
      closable: true
    }

    if (active && !active.closed) {
      this.options.notify.update(active.toastId, options)
      this.active.delete(run.id)
      return
    }

    this.active.delete(run.id)
    if (notify.showResult === true) {
      this.options.notify.show(options, `task-run.result.${run.id}`)
    }
  }

  private requestCancel(run: TaskRun, toastId: string): void {
    const accepted = this.options.cancelRun(run.id)
    if (!accepted) {
      this.options.notify.update(toastId, {
        title: run.title,
        message: '任务已结束或不可取消。',
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
      message: '正在取消...',
      type: 'loading',
      closable: true
    })
  }
}

function createCancelAction(run: TaskRun): NotifyOptions['action'] {
  if (!run.controls.cancelable || run.status === 'cancelling') {
    return undefined
  }

  return {
    id: CANCEL_ACTION_ID,
    label: '取消'
  }
}

function formatActiveMessage(run: TaskRun, presentation: TaskRunPresentation): string | undefined {
  const notify = presentation.notify
  if (run.status === 'cancelling') {
    return '正在取消...'
  }

  const base = notify?.message ?? run.progress?.message ?? run.progress?.phase ?? run.description
  if (notify?.showProgress === false || !run.progress) {
    return base
  }

  const count = formatProgressCount(run)
  const percent =
    run.progress.percent === undefined ? undefined : `${Math.round(run.progress.percent)}%`
  const suffix = [count, percent].filter(Boolean).join(' ')
  return suffix ? [base, suffix].filter(Boolean).join(' ') : base
}

function formatProgressCount(run: TaskRun): string | undefined {
  const current = run.progress?.current
  const total = run.progress?.total
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

function resolveFinalTitle(run: TaskRun, presentation: TaskRunPresentation): string {
  const title = presentation.notify?.title ?? run.result?.title ?? run.title
  switch (run.status) {
    case 'completed':
      return `${title}已完成`
    case 'cancelled':
      return `${title}已取消`
    case 'failed':
      return `${title}失败`
    default:
      return title
  }
}

function resolveFinalMessage(run: TaskRun): string | undefined {
  return run.result?.summary ?? run.result?.error ?? run.progress?.message ?? run.description
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
