<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { TaskRun } from '@shared/task-run'
import { Icon } from '@renderer/components/ui/icon'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@renderer/components/ui/table'
import { notify } from '@renderer/core/notify'
import { useI18n } from '@renderer/composables/use-i18n'
import { useTaskRunStore } from '@renderer/stores'
import type { TaskCenterTab, TaskRunCategoryFilter, TaskRunStatusFilter } from '../types'
import { matchesTaskRunSearch } from '../utils/display'
import {
  ActiveTaskRunDetailsDialog,
  ActiveTaskRunRow,
  ActiveTaskRunToolbar,
  CompletedTaskRunDetailsDialog,
  CompletedTaskRunRow,
  CompletedTaskRunToolbar
} from './tabs'

const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()

const ACTIVE_RUN_TABLE_COLUMNS = ['32%', '', '6rem', '8.25rem']
const COMPLETED_RUN_TABLE_COLUMNS = ['32%', '', '6rem', '4rem']

const store = useTaskRunStore()
const { activeRuns, completedRuns, activeCount, completedCount, refreshing, error } =
  storeToRefs(store)

const selectedTab = ref<TaskCenterTab>('active')
const activeDetailsDialogOpen = ref(false)
const completedDetailsDialogOpen = ref(false)
const activeDetailsRunId = ref<string | null>(null)
const completedDetailsRunId = ref<string | null>(null)
const activeSearch = ref('')
const completedSearch = ref('')
const activeCategoryFilter = ref<TaskRunCategoryFilter>('all')
const completedCategoryFilter = ref<TaskRunCategoryFilter>('all')
const activeStatusFilter = ref<TaskRunStatusFilter>('all')
const completedStatusFilter = ref<TaskRunStatusFilter>('all')
const clearing = ref(false)

const filteredActiveRuns = computed(() =>
  activeRuns.value.filter((run) =>
    matchesFilters(run, activeSearch.value, activeCategoryFilter.value, activeStatusFilter.value)
  )
)
const filteredCompletedRuns = computed(() =>
  completedRuns.value.filter((run) =>
    matchesFilters(
      run,
      completedSearch.value,
      completedCategoryFilter.value,
      completedStatusFilter.value
    )
  )
)
const activeDetailsRun = computed(() => {
  const id = activeDetailsRunId.value
  if (!id) return null
  return store.getRun(id) ?? null
})
const completedDetailsRun = computed(() => {
  const id = completedDetailsRunId.value
  if (!id) return null
  return store.getRun(id) ?? null
})

watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      void store.init()
    }
  },
  { immediate: true }
)

watch(activeDetailsDialogOpen, (isOpen) => {
  if (!isOpen) {
    activeDetailsRunId.value = null
  }
})

watch(completedDetailsDialogOpen, (isOpen) => {
  if (!isOpen) {
    completedDetailsRunId.value = null
  }
})

function matchesFilters(
  run: TaskRun,
  search: string,
  category: TaskRunCategoryFilter,
  status: TaskRunStatusFilter
): boolean {
  if (category !== 'all' && run.category !== category) {
    return false
  }

  if (status !== 'all' && run.status !== status) {
    return false
  }

  return matchesTaskRunSearch(run, search)
}

function openActiveDetailsDialog(run: TaskRun): void {
  activeDetailsRunId.value = run.id
  activeDetailsDialogOpen.value = true
}

function openCompletedDetailsDialog(run: TaskRun): void {
  completedDetailsRunId.value = run.id
  completedDetailsDialogOpen.value = true
}

async function handleRefresh(): Promise<void> {
  try {
    await store.refresh()
  } catch (refreshError) {
    notify.error(
      m.value.task.feedback.refreshFailed,
      refreshError instanceof Error ? refreshError.message : String(refreshError)
    )
  }
}

async function handleClearCompleted(): Promise<void> {
  clearing.value = true
  try {
    await store.clearCompleted()
  } catch (clearError) {
    notify.error(
      m.value.task.feedback.clearFailed,
      clearError instanceof Error ? clearError.message : String(clearError)
    )
  } finally {
    clearing.value = false
  }
}

async function handleDeleteCompleted(run: TaskRun): Promise<void> {
  try {
    await store.deleteCompleted(run.id)
    if (completedDetailsRunId.value === run.id) {
      completedDetailsDialogOpen.value = false
    }
  } catch (deleteError) {
    notify.error(
      m.value.task.feedback.deleteFailed,
      deleteError instanceof Error ? deleteError.message : String(deleteError)
    )
  }
}

async function handlePause(run: TaskRun): Promise<void> {
  try {
    const accepted = await store.pauseRun(run.id)
    if (!accepted) {
      notify.info(m.value.task.feedback.cannotPauseNow)
    }
  } catch (pauseError) {
    notify.error(
      m.value.task.feedback.pauseFailed,
      pauseError instanceof Error ? pauseError.message : String(pauseError)
    )
  }
}

async function handleResume(run: TaskRun): Promise<void> {
  try {
    const accepted = await store.resumeRun(run.id)
    if (!accepted) {
      notify.info(m.value.task.feedback.cannotResumeNow)
    }
  } catch (resumeError) {
    notify.error(
      m.value.task.feedback.resumeFailed,
      resumeError instanceof Error ? resumeError.message : String(resumeError)
    )
  }
}

async function handleCancel(run: TaskRun): Promise<void> {
  try {
    const accepted = await store.cancelRun(run.id)
    if (!accepted) {
      notify.info(m.value.task.feedback.cannotCancel)
    }
  } catch (cancelError) {
    notify.error(
      m.value.task.feedback.cancelFailed,
      cancelError instanceof Error ? cancelError.message : String(cancelError)
    )
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="w-[min(calc(100vw-2rem),980px)] max-w-none">
      <DialogHeader>
        <DialogTitle>{{ m.task.center }}</DialogTitle>
      </DialogHeader>

      <DialogBody class="overflow-hidden p-0">
        <Tabs
          v-model="selectedTab"
          class="flex h-[min(72vh,660px)] min-h-[420px] flex-col gap-0 overflow-hidden"
        >
          <div class="shrink-0 border-b border-border px-4 py-2">
            <TabsList>
              <TabsTrigger value="active">{{ m.task.tabActive }} ({{ activeCount }})</TabsTrigger>
              <TabsTrigger value="completed">
                {{ m.task.tabCompleted }} ({{ completedCount }})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="active"
            class="m-0 min-h-0 flex-1 overflow-hidden"
          >
            <div class="flex h-full flex-col">
              <ActiveTaskRunToolbar
                v-model:search="activeSearch"
                v-model:category="activeCategoryFilter"
                v-model:status="activeStatusFilter"
                :filtered-count="filteredActiveRuns.length"
                :refreshing="refreshing"
                @refresh="handleRefresh"
              />

              <div
                v-if="error"
                class="border-b border-border bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {{ error }}
              </div>

              <div class="min-h-0 flex-1">
                <div
                  v-if="filteredActiveRuns.length === 0"
                  class="flex h-full min-h-48 items-center justify-center text-sm text-muted-foreground"
                >
                  {{ m.task.noActiveTasks }}
                </div>
                <Table
                  v-else
                  fixed-header
                  :columns="ACTIVE_RUN_TABLE_COLUMNS"
                  body-class="overflow-x-hidden"
                >
                  <template #header>
                    <TableHeader>
                      <TableRow class="h-8">
                        <TableHead class="pl-4">{{ m.task.table.task }}</TableHead>
                        <TableHead>{{ m.task.table.progress }}</TableHead>
                        <TableHead>{{ m.task.table.status }}</TableHead>
                        <TableHead class="pr-4 text-right">{{ m.task.table.actions }}</TableHead>
                      </TableRow>
                    </TableHeader>
                  </template>

                  <TableBody>
                    <ActiveTaskRunRow
                      v-for="run in filteredActiveRuns"
                      :key="run.id"
                      :run="run"
                      :busy="store.isControlPending(run.id)"
                      @details="openActiveDetailsDialog"
                      @pause="handlePause"
                      @resume="handleResume"
                      @cancel="handleCancel"
                    />
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="completed"
            class="m-0 min-h-0 flex-1 overflow-hidden"
          >
            <div class="flex h-full flex-col">
              <CompletedTaskRunToolbar
                v-model:search="completedSearch"
                v-model:category="completedCategoryFilter"
                v-model:status="completedStatusFilter"
                :filtered-count="filteredCompletedRuns.length"
                :completed-count="completedCount"
                :refreshing="refreshing"
                :clearing="clearing"
                @refresh="handleRefresh"
                @clear-completed="handleClearCompleted"
              />

              <div
                v-if="error"
                class="border-b border-border bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {{ error }}
              </div>

              <div class="min-h-0 flex-1">
                <div
                  v-if="filteredCompletedRuns.length === 0"
                  class="flex h-full min-h-48 flex-col items-center justify-center gap-2 text-sm text-muted-foreground"
                >
                  <Icon
                    icon="icon-[mdi--archive-outline]"
                    class="size-8 opacity-40"
                  />
                  <span>{{ m.task.noCompletedRecords }}</span>
                </div>
                <Table
                  v-else
                  fixed-header
                  :columns="COMPLETED_RUN_TABLE_COLUMNS"
                  body-class="overflow-x-hidden"
                >
                  <template #header>
                    <TableHeader>
                      <TableRow class="h-8">
                        <TableHead class="pl-4">{{ m.task.table.task }}</TableHead>
                        <TableHead>{{ m.task.table.result }}</TableHead>
                        <TableHead>{{ m.task.table.status }}</TableHead>
                        <TableHead class="pr-4 text-right">{{ m.task.table.actions }}</TableHead>
                      </TableRow>
                    </TableHeader>
                  </template>

                  <TableBody>
                    <CompletedTaskRunRow
                      v-for="run in filteredCompletedRuns"
                      :key="run.id"
                      :run="run"
                      @details="openCompletedDetailsDialog"
                      @delete="handleDeleteCompleted"
                    />
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogBody>
    </DialogContent>
  </Dialog>

  <ActiveTaskRunDetailsDialog
    v-if="activeDetailsDialogOpen && activeDetailsRun"
    v-model:open="activeDetailsDialogOpen"
    :run="activeDetailsRun"
  />

  <CompletedTaskRunDetailsDialog
    v-if="completedDetailsDialogOpen && completedDetailsRun"
    v-model:open="completedDetailsDialogOpen"
    :run="completedDetailsRun"
  />
</template>
