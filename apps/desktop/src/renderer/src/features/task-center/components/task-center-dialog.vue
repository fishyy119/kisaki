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
import { notify } from '@renderer/core/notify'
import { useTaskRunStore } from '@renderer/stores'
import type { TaskCenterTab, TaskRunCategoryFilter, TaskRunStatusFilter } from '../types'
import { matchesTaskRunSearch } from '../utils'
import {
  ActiveTaskRunDetailsDialog,
  ActiveTaskRunRow,
  ActiveTaskRunToolbar,
  CompletedTaskRunDetailsDialog,
  CompletedTaskRunRow,
  CompletedTaskRunToolbar
} from './tabs'

const open = defineModel<boolean>('open', { required: true })

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
      '刷新任务中心失败',
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
      '清理任务记录失败',
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
      '删除任务记录失败',
      deleteError instanceof Error ? deleteError.message : String(deleteError)
    )
  }
}

async function handlePause(run: TaskRun): Promise<void> {
  try {
    const accepted = await store.pauseRun(run.id)
    if (!accepted) {
      notify.info('任务暂时不能暂停')
    }
  } catch (pauseError) {
    notify.error(
      '暂停任务失败',
      pauseError instanceof Error ? pauseError.message : String(pauseError)
    )
  }
}

async function handleResume(run: TaskRun): Promise<void> {
  try {
    const accepted = await store.resumeRun(run.id)
    if (!accepted) {
      notify.info('任务暂时不能继续')
    }
  } catch (resumeError) {
    notify.error(
      '继续任务失败',
      resumeError instanceof Error ? resumeError.message : String(resumeError)
    )
  }
}

async function handleCancel(run: TaskRun): Promise<void> {
  try {
    const accepted = await store.cancelRun(run.id)
    if (!accepted) {
      notify.info('任务已结束或不可取消')
    }
  } catch (cancelError) {
    notify.error(
      '取消任务失败',
      cancelError instanceof Error ? cancelError.message : String(cancelError)
    )
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="w-[min(calc(100vw-2rem),980px)] max-w-none">
      <DialogHeader>
        <DialogTitle>任务中心</DialogTitle>
      </DialogHeader>

      <DialogBody class="overflow-hidden p-0">
        <Tabs
          v-model="selectedTab"
          class="flex h-[min(72vh,660px)] min-h-[420px] flex-col gap-0 overflow-hidden"
        >
          <div class="shrink-0 border-b border-border px-4 py-2">
            <TabsList>
              <TabsTrigger value="active">进行中 ({{ activeCount }})</TabsTrigger>
              <TabsTrigger value="completed">已完成 ({{ completedCount }})</TabsTrigger>
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

              <div class="min-h-0 flex-1 overflow-auto overflow-x-hidden">
                <div
                  v-if="filteredActiveRuns.length === 0"
                  class="flex h-full min-h-48 items-center justify-center text-sm text-muted-foreground"
                >
                  暂无进行中的任务
                </div>
                <template v-else>
                  <div
                    class="sticky top-0 z-10 grid h-8 grid-cols-[minmax(0,1.2fr)_minmax(0,2.55fr)_96px_132px] items-center gap-5 border-b border-border bg-background px-4 text-xs font-medium text-muted-foreground"
                  >
                    <div>任务</div>
                    <div>进度</div>
                    <div>状态</div>
                    <div class="text-right">操作</div>
                  </div>
                  <div class="divide-y divide-border/50">
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
                  </div>
                </template>
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

              <div class="min-h-0 flex-1 overflow-auto overflow-x-hidden">
                <div
                  v-if="filteredCompletedRuns.length === 0"
                  class="flex h-full min-h-48 flex-col items-center justify-center gap-2 text-sm text-muted-foreground"
                >
                  <Icon
                    icon="icon-[mdi--archive-outline]"
                    class="size-8 opacity-40"
                  />
                  <span>暂无完成记录</span>
                </div>
                <template v-else>
                  <div
                    class="sticky top-0 z-10 grid h-8 grid-cols-[minmax(0,1.2fr)_minmax(0,2.55fr)_96px_64px] items-center gap-5 border-b border-border bg-background px-4 text-xs font-medium text-muted-foreground"
                  >
                    <div>任务</div>
                    <div>结果</div>
                    <div>状态</div>
                    <div class="text-right">操作</div>
                  </div>
                  <div class="divide-y divide-border/50">
                    <CompletedTaskRunRow
                      v-for="run in filteredCompletedRuns"
                      :key="run.id"
                      :run="run"
                      @details="openCompletedDetailsDialog"
                      @delete="handleDeleteCompleted"
                    />
                  </div>
                </template>
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
