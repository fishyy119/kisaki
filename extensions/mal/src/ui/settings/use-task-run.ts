import { computed, onUnmounted, ref, type ComputedRef, type Ref } from 'vue'
import type { MalTaskStateView } from '../../shared/settings'
import { m } from './i18n'
import { host, toErrorMessage } from './rpc'

const ACTIVE_STATUSES = ['queued', 'running', 'pausing', 'paused', 'cancelling']

export interface TaskRunController {
  task: Ref<MalTaskStateView | null>
  starting: Ref<boolean>
  active: ComputedRef<boolean>
  percent: ComputedRef<number | null>
  statusLabel: ComputedRef<string>
  start(run: () => Promise<{ runId: string }>): void
  cancel(): void
}

/**
 * Owns one task-run launch and its cosmetic polling. The task run itself
 * reports the authoritative outcome through the app task center.
 */
export function useTaskRun(onError: (message: string) => void): TaskRunController {
  const task = ref<MalTaskStateView | null>(null)
  const starting = ref(false)
  let pollTimer: ReturnType<typeof setInterval> | undefined

  const active = computed(() => task.value !== null && ACTIVE_STATUSES.includes(task.value.status))
  const percent = computed<number | null>(() => {
    if (!task.value?.total || task.value.current === undefined) {
      return null
    }
    return Math.round((task.value.current / task.value.total) * 100)
  })
  const statusLabel = computed(() => {
    switch (task.value?.status) {
      case 'completed':
        return m.value.ui.task.completed
      case 'failed':
        return m.value.ui.task.failed
      case 'cancelled':
        return m.value.ui.task.cancelled
      default:
        return m.value.ui.task.running
    }
  })

  onUnmounted(stopPolling)

  function start(run: () => Promise<{ runId: string }>): void {
    if (starting.value || active.value) {
      return
    }

    starting.value = true
    void run()
      .then(({ runId }) => {
        task.value = { runId, status: 'queued' }
        startPolling(runId)
      })
      .catch((error: unknown) => {
        onError(toErrorMessage(error))
      })
      .finally(() => {
        starting.value = false
      })
  }

  function cancel(): void {
    const runId = task.value?.runId
    if (!runId) {
      return
    }

    void host.cancelTask(runId).catch((error: unknown) => {
      onError(toErrorMessage(error))
    })
  }

  function startPolling(runId: string): void {
    stopPolling()
    pollTimer = setInterval(() => {
      void host
        .getTaskState(runId)
        .then((state) => {
          if (state) {
            task.value = state
          }
          if (!state || !ACTIVE_STATUSES.includes(state.status)) {
            stopPolling()
          }
        })
        .catch(() => {
          // Polling is cosmetic; the task run itself reports its outcome.
        })
    }, 1000)
  }

  function stopPolling(): void {
    if (pollTimer !== undefined) {
      clearInterval(pollTimer)
      pollTimer = undefined
    }
  }

  return { task, starting, active, percent, statusLabel, start, cancel }
}
