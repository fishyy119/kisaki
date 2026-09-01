/**
 * Task Run Store
 *
 * Renderer-side read model for the task center. Main process remains the
 * source of truth; every task-run event carries a complete snapshot.
 */

import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { TaskRun, TaskRunFinalStatus, TaskRunStatus } from '@shared/task-run'
import { ipcManager, unwrapIpcData, unwrapIpcVoid } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'

const log = createLogger('TaskRun')

const ACTIVE_STATUSES = new Set<TaskRunStatus>([
  'queued',
  'running',
  'pausing',
  'paused',
  'cancelling'
])

const FINAL_STATUSES = new Set<TaskRunStatus>(['completed', 'failed', 'cancelled'])

export const useTaskRunStore = defineStore('task-run', () => {
  // Runs are replaced wholesale on every event, so a shallow holder sees
  // every change without deep-proxying each snapshot.
  const runs = shallowRef(new Map<string, TaskRun>())
  const initialized = ref(false)
  const refreshing = ref(false)
  const pendingControlRunIds = shallowRef(new Set<string>())
  const error = ref<string | null>(null)

  let listenersRegistered = false

  const activeRuns = computed(() =>
    [...runs.value.values()].filter(isActiveRun).sort(compareActiveRuns)
  )

  const completedRuns = computed(() =>
    [...runs.value.values()].filter(isFinalRun).sort(compareCompletedRuns)
  )

  const activeCount = computed(() => activeRuns.value.length)
  const completedCount = computed(() => completedRuns.value.length)

  function updateRun(run: TaskRun): void {
    const next = new Map(runs.value)
    next.set(run.id, run)
    runs.value = next
  }

  function removeRun(runId: string): void {
    const next = new Map(runs.value)
    next.delete(runId)
    runs.value = next
  }

  function getRun(runId: string): TaskRun | undefined {
    return runs.value.get(runId)
  }

  function replaceRuns(nextRuns: readonly TaskRun[]): void {
    const next = new Map<string, TaskRun>()
    for (const run of nextRuns) {
      next.set(run.id, run)
    }
    runs.value = next
  }

  async function refresh(): Promise<void> {
    refreshing.value = true
    error.value = null

    try {
      const [active, history] = await Promise.all([
        ipcManager.invoke('task-run:list-active').then(unwrapIpcData),
        ipcManager.invoke('task-run:list-history').then(unwrapIpcData)
      ])
      replaceRuns([...history, ...active])
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : String(refreshError)
      error.value = message
      log.error('Failed to refresh task runs:', refreshError)
      throw refreshError
    } finally {
      refreshing.value = false
    }
  }

  async function init(): Promise<void> {
    if (initialized.value) return

    setupListeners()

    try {
      await refresh()
      initialized.value = true
    } catch {
      initialized.value = false
    }
  }

  async function clearCompleted(): Promise<void> {
    unwrapIpcVoid(await ipcManager.invoke('task-run:clear-completed'))
  }

  async function deleteCompleted(runId: string): Promise<void> {
    unwrapIpcVoid(await ipcManager.invoke('task-run:delete-history', runId))
  }

  async function cancelRun(runId: string): Promise<boolean> {
    return withPendingControl(runId, async () =>
      unwrapIpcData(await ipcManager.invoke('task-run:cancel', runId))
    )
  }

  async function pauseRun(runId: string): Promise<boolean> {
    return withPendingControl(runId, async () =>
      unwrapIpcData(await ipcManager.invoke('task-run:pause', runId))
    )
  }

  async function resumeRun(runId: string): Promise<boolean> {
    return withPendingControl(runId, async () =>
      unwrapIpcData(await ipcManager.invoke('task-run:resume', runId))
    )
  }

  async function waitRun(runId: string): Promise<TaskRun> {
    const waitResult = await ipcManager.invoke('task-run:wait', runId)
    if (waitResult.success) {
      updateRun(waitResult.data)
      return waitResult.data
    }

    const history = unwrapIpcData(await ipcManager.invoke('task-run:get-history', runId))
    if (history) {
      updateRun(history)
      return history
    }

    throw new Error(waitResult.error)
  }

  function isControlPending(runId: string): boolean {
    return pendingControlRunIds.value.has(runId)
  }

  function setupListeners(): void {
    if (listenersRegistered) return
    listenersRegistered = true

    ipcManager.on('task-run:changed', (_event, run) => {
      updateRun(run)
    })

    ipcManager.on('task-run:deleted', (_event, payload) => {
      removeRun(payload.runId)
    })
  }

  async function withPendingControl<T>(runId: string, action: () => Promise<T> | T): Promise<T> {
    setPendingControl(runId, true)
    try {
      return await action()
    } finally {
      setPendingControl(runId, false)
    }
  }

  function setPendingControl(runId: string, pending: boolean): void {
    const next = new Set(pendingControlRunIds.value)
    if (pending) {
      next.add(runId)
    } else {
      next.delete(runId)
    }
    pendingControlRunIds.value = next
  }

  return {
    runs,
    initialized,
    refreshing,
    error,
    activeRuns,
    completedRuns,
    activeCount,
    completedCount,
    init,
    refresh,
    updateRun,
    removeRun,
    getRun,
    clearCompleted,
    deleteCompleted,
    cancelRun,
    pauseRun,
    resumeRun,
    waitRun,
    isControlPending
  }
})

function isActiveRun(run: TaskRun): boolean {
  return ACTIVE_STATUSES.has(run.status)
}

function isFinalRun(run: TaskRun): run is TaskRun & { status: TaskRunFinalStatus } {
  return FINAL_STATUSES.has(run.status)
}

function compareActiveRuns(left: TaskRun, right: TaskRun): number {
  const priority = activeStatusPriority(left.status) - activeStatusPriority(right.status)
  if (priority !== 0) return priority
  return right.updatedAt - left.updatedAt
}

function activeStatusPriority(status: TaskRunStatus): number {
  switch (status) {
    case 'cancelling':
      return 0
    case 'paused':
    case 'pausing':
      return 1
    case 'running':
      return 2
    case 'queued':
      return 3
    default:
      return 4
  }
}

function compareCompletedRuns(left: TaskRun, right: TaskRun): number {
  return (right.finishedAt ?? 0) - (left.finishedAt ?? 0)
}
