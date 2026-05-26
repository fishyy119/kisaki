<!--
Background Task Page owns task data, filters, and task actions.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Spinner } from '@renderer/components/ui/spinner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@renderer/components/ui/alert-dialog'
import { notify } from '@renderer/core/notify'
import { createLogger } from '@renderer/core/log'
import { ipcManager, unwrapIpcData, unwrapIpcVoid } from '@renderer/core/ipc'
import { useAsyncData, useEvent, useRenderState } from '@renderer/composables'
import type { BackgroundTask } from '@shared/background-task'
import type { CommandListItem } from '@shared/command'
import {
  BackgroundTaskDetailsDialog,
  BackgroundTaskFormDialog,
  BackgroundTaskHeader,
  BackgroundTaskRow,
  BackgroundTaskToolbar
} from '../components'
import { BACKGROUND_TASK_LIST_GRID_TEMPLATE } from '../utils'
import type {
  BackgroundTaskSortDirection,
  BackgroundTaskSortField,
  BackgroundTaskSourceFilter,
  BackgroundTaskStatusFilter
} from '../types'

const log = createLogger('BackgroundTask')

const searchQuery = ref('')
const statusFilter = ref<BackgroundTaskStatusFilter>('all')
const sourceFilter = ref<BackgroundTaskSourceFilter>('all')
const sortField = ref<BackgroundTaskSortField>('createdAt')
const sortDirection = ref<BackgroundTaskSortDirection>('desc')

const runningTaskIds = ref(new Set<string>())
const busyTaskIds = ref(new Set<string>())
const formDialogOpen = ref(false)
const detailsDialogOpen = ref(false)
const deleteDialogOpen = ref(false)
const editingTask = ref<BackgroundTask | null>(null)
const detailsTask = ref<BackgroundTask | null>(null)
const pendingDeleteTask = ref<BackgroundTask | null>(null)
const deleting = ref(false)

const {
  data: tasks,
  isLoading,
  isFetching,
  error,
  refetch: refetchTasks
} = useAsyncData(fetchTasks)

const { data: commands, refetch: refetchCommands } = useAsyncData(() =>
  ipcManager.invoke('command:list').then(unwrapIpcData)
)

const state = useRenderState(isLoading, error, tasks)
const taskList = computed(() => tasks.value ?? [])
const commandList = computed(() => commands.value ?? [])
const commandById = computed(() => {
  const map = new Map<string, CommandListItem>()
  for (const command of commandList.value) {
    map.set(command.id, command)
  }
  return map
})

const filteredTasks = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  let result = taskList.value.filter((task) => {
    const command = commandById.value.get(task.commandId)
    const matchesSearch =
      !query ||
      [task.name, task.commandId, task.ownerExtensionId, command?.title, command?.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))

    if (!matchesSearch) {
      return false
    }

    if (sourceFilter.value !== 'all' && task.createdBy !== sourceFilter.value) {
      return false
    }

    switch (statusFilter.value) {
      case 'enabled':
        return task.enabled
      case 'disabled':
        return !task.enabled
      case 'running':
        return runningTaskIds.value.has(task.id)
      case 'failed':
        return !runningTaskIds.value.has(task.id) && task.history[0]?.status === 'failed'
      case 'all':
        return true
    }
  })

  result = [...result].sort(compareTasks)
  return result
})

const selectedDetailsTask = computed(() =>
  detailsTask.value
    ? (taskList.value.find((task) => task.id === detailsTask.value?.id) ?? detailsTask.value)
    : null
)
const selectedDetailsCommand = computed(() =>
  selectedDetailsTask.value ? commandById.value.get(selectedDetailsTask.value.commandId) : undefined
)

async function fetchTasks(): Promise<BackgroundTask[]> {
  const [items, runningIds] = await Promise.all([
    ipcManager.invoke('background-task:list').then(unwrapIpcData),
    ipcManager.invoke('background-task:list-running').then(unwrapIpcData)
  ])
  runningTaskIds.value = new Set(runningIds)
  return items
}

useEvent('backgroundTask.changed', () => {
  void refreshAll()
})

useEvent('backgroundTask.deleted', ({ taskId }) => {
  removeFromSet(runningTaskIds, taskId)
  void refreshAll()
})

useEvent('backgroundTask.started', ({ taskId }) => {
  addToSet(runningTaskIds, taskId)
  void refetchTasks()
})

useEvent('backgroundTask.finished', (record) => {
  removeFromSet(runningTaskIds, record.taskId)
  void refetchTasks()
})

function compareTasks(left: BackgroundTask, right: BackgroundTask): number {
  let comparison = 0
  switch (sortField.value) {
    case 'name':
      comparison = left.name.localeCompare(right.name)
      break
    case 'lastRunAt':
      comparison = (left.lastRunAt ?? 0) - (right.lastRunAt ?? 0)
      break
    case 'nextRunAt':
      comparison = getNextRunSortValue(left) - getNextRunSortValue(right)
      break
    case 'createdAt':
      comparison = left.createdAt - right.createdAt
      break
  }

  return sortDirection.value === 'asc' ? comparison : -comparison
}

function getNextRunSortValue(task: BackgroundTask): number {
  return task.nextRunAt ?? Number.MAX_SAFE_INTEGER
}

function getCommand(task: BackgroundTask): CommandListItem | undefined {
  return commandById.value.get(task.commandId)
}

function isTaskRunning(taskId: string): boolean {
  return runningTaskIds.value.has(taskId)
}

function isTaskBusy(taskId: string): boolean {
  return busyTaskIds.value.has(taskId)
}

function openCreateDialog() {
  editingTask.value = null
  formDialogOpen.value = true
}

function openEditDialog(task: BackgroundTask) {
  editingTask.value = task
  formDialogOpen.value = true
}

function openDetailsDialog(task: BackgroundTask) {
  detailsTask.value = task
  detailsDialogOpen.value = true
}

function requestDeleteTask(task: BackgroundTask) {
  pendingDeleteTask.value = task
  deleteDialogOpen.value = true
}

async function refreshAll() {
  await Promise.all([refetchTasks(), refetchCommands()])
}

async function handleSaved() {
  await refreshAll()
}

async function handleRun(task: BackgroundTask) {
  addToSet(runningTaskIds, task.id)
  try {
    const record = unwrapIpcData(await ipcManager.invoke('background-task:run', task.id))
    if (record.status === 'success') {
      notify.success('后台任务已完成')
    } else if (record.status === 'cancelled') {
      notify.info('后台任务已取消')
    } else if (record.status === 'skipped') {
      notify.warning('后台任务已跳过', record.error)
    } else {
      notify.error('后台任务运行失败', record.error)
    }
  } catch (error) {
    log.error('Failed to run background task:', error)
    notify.error('运行后台任务失败', error instanceof Error ? error.message : String(error))
  } finally {
    removeFromSet(runningTaskIds, task.id)
    await refetchTasks()
  }
}

async function handleCancel(task: BackgroundTask) {
  setBusy(task.id, true)
  try {
    const cancelled = unwrapIpcData(await ipcManager.invoke('background-task:cancel', task.id))
    if (cancelled) {
      notify.info('已请求取消后台任务')
    } else {
      notify.info('后台任务未在运行')
      removeFromSet(runningTaskIds, task.id)
    }
  } catch (error) {
    log.error('Failed to cancel background task:', error)
    notify.error('取消后台任务失败', error instanceof Error ? error.message : String(error))
  } finally {
    setBusy(task.id, false)
  }
}

async function handleSetEnabled(task: BackgroundTask, enabled: boolean) {
  setBusy(task.id, true)
  try {
    unwrapIpcData(await ipcManager.invoke('background-task:set-enabled', task.id, enabled))
    notify.success(enabled ? '后台任务已启用' : '后台任务已禁用')
    await refetchTasks()
  } catch (error) {
    log.error('Failed to toggle background task:', error)
    notify.error('更新后台任务失败', error instanceof Error ? error.message : String(error))
  } finally {
    setBusy(task.id, false)
  }
}

async function handleDeleteConfirmed() {
  const task = pendingDeleteTask.value
  if (!task) {
    return
  }

  deleting.value = true
  setBusy(task.id, true)
  try {
    unwrapIpcVoid(await ipcManager.invoke('background-task:delete', task.id))
    notify.success('后台任务已删除')
    deleteDialogOpen.value = false
    pendingDeleteTask.value = null
    await refetchTasks()
  } catch (error) {
    log.error('Failed to delete background task:', error)
    notify.error('删除后台任务失败', error instanceof Error ? error.message : String(error))
  } finally {
    setBusy(task.id, false)
    deleting.value = false
  }
}

function setBusy(taskId: string, busy: boolean) {
  if (busy) {
    addToSet(busyTaskIds, taskId)
  } else {
    removeFromSet(busyTaskIds, taskId)
  }
}

function addToSet(target: typeof runningTaskIds, value: string) {
  const next = new Set(target.value)
  next.add(value)
  target.value = next
}

function removeFromSet(target: typeof runningTaskIds, value: string) {
  const next = new Set(target.value)
  next.delete(value)
  target.value = next
}
</script>

<template>
  <div class="flex h-full flex-col">
    <BackgroundTaskHeader
      :total-tasks="taskList.length"
      :running-tasks="runningTaskIds.size"
      :refreshing="isFetching"
      @create="openCreateDialog"
      @refresh="refreshAll"
    />

    <BackgroundTaskToolbar
      v-model:search-query="searchQuery"
      v-model:status-filter="statusFilter"
      v-model:source-filter="sourceFilter"
      v-model:sort-field="sortField"
      v-model:sort-direction="sortDirection"
      :filtered-count="filteredTasks.length"
    />

    <div class="min-h-0 flex-1">
      <div
        v-if="state === 'loading'"
        class="flex h-full items-center justify-center"
      >
        <Spinner class="size-8" />
      </div>

      <div
        v-else-if="state === 'error'"
        class="flex h-full flex-col items-center justify-center text-muted-foreground"
      >
        <Icon
          icon="icon-[mdi--alert-circle-outline]"
          class="mb-3 size-12 opacity-40"
        />
        <div class="text-sm font-medium">后台任务加载失败</div>
        <div class="mt-1 text-xs">{{ error }}</div>
      </div>

      <div
        v-else-if="taskList.length === 0"
        class="flex h-full flex-col items-center justify-center text-muted-foreground"
      >
        <Icon
          icon="icon-[mdi--timer-outline]"
          class="mb-3 size-16 opacity-30"
        />
        <div class="text-sm font-medium">暂无后台任务</div>
      </div>

      <div
        v-else-if="filteredTasks.length === 0"
        class="flex h-full flex-col items-center justify-center text-muted-foreground"
      >
        <Icon
          icon="icon-[mdi--filter-off-outline]"
          class="mb-3 size-16 opacity-30"
        />
        <div class="text-sm font-medium">没有匹配的后台任务</div>
      </div>

      <div
        v-else
        class="h-full overflow-auto scrollbar-thin"
      >
        <div
          class="sticky top-0 z-10 grid h-8 items-center gap-3 border-b border-border bg-background px-4 text-xs font-medium text-muted-foreground"
          :style="{ gridTemplateColumns: BACKGROUND_TASK_LIST_GRID_TEMPLATE }"
        >
          <div>名称</div>
          <div>命令</div>
          <div>触发</div>
          <div>运行</div>
          <div>状态</div>
          <div class="text-right">操作</div>
        </div>

        <div class="divide-y divide-border/50">
          <BackgroundTaskRow
            v-for="task in filteredTasks"
            :key="task.id"
            :task="task"
            :command="getCommand(task)"
            :running="isTaskRunning(task.id)"
            :busy="isTaskBusy(task.id)"
            @run="handleRun(task)"
            @cancel="handleCancel(task)"
            @set-enabled="(enabled) => handleSetEnabled(task, enabled)"
            @edit="openEditDialog(task)"
            @details="openDetailsDialog(task)"
            @delete="requestDeleteTask(task)"
          />
        </div>
      </div>
    </div>

    <BackgroundTaskFormDialog
      v-if="formDialogOpen"
      v-model:open="formDialogOpen"
      :task="editingTask"
      @saved="handleSaved"
    />

    <BackgroundTaskDetailsDialog
      v-if="detailsDialogOpen && selectedDetailsTask"
      v-model:open="detailsDialogOpen"
      :task="selectedDetailsTask"
      :command="selectedDetailsCommand"
      :running="isTaskRunning(selectedDetailsTask.id)"
    />

    <AlertDialog v-model:open="deleteDialogOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>删除后台任务？</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>
          确定要删除「{{ pendingDeleteTask?.name }}」吗？此操作无法撤销。
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="deleting">取消</AlertDialogCancel>
          <AlertDialogAction
            :disabled="deleting"
            @click="handleDeleteConfirmed"
          >
            {{ deleting ? '删除中' : '删除' }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
