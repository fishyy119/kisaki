<!-- Task lists, controls, and a virtualized history with uniform table rows. -->
<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useVirtualizer } from '@tanstack/vue-virtual'
import type { TaskRun } from '@shared/task-run'
import { StateView } from '@renderer/components/ui/state-view'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { Table, TableBody, type TableColumn } from '@renderer/components/ui/table'
import { Toolbar, ToolbarRow } from '@renderer/components/ui/toolbar'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { cn } from '@renderer/utils/cn'
import { remToPx } from '@renderer/core/interface-scale'
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

// Both lists keep readable fields at 48rem and scroll within narrower dialogs.
const activeColumns = computed<TableColumn[]>(() => [
  { label: m.value.task.table.task },
  { label: m.value.task.table.phase, width: '10rem', tone: 'muted' },
  { label: m.value.task.table.progress, width: '10rem' },
  { label: m.value.task.table.status, width: '7rem' },
  { label: m.value.task.table.actions, width: '9.5rem', align: 'end' }
])
const completedColumns = computed<TableColumn[]>(() => [
  { label: m.value.task.table.task },
  { label: m.value.task.table.result },
  { label: m.value.task.table.duration, width: '6rem' },
  { label: m.value.task.table.status, width: '7rem' },
  { label: m.value.task.table.actions, width: '7rem', align: 'end' }
])

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

// =============================================================================
// Completed rows virtualization
//
// History holds up to 500 final runs; rows virtualize with spacer rows so the
// native table layout (shared colgroup) stays intact. Row height is fixed by
// TableCell (h-10, including its border).
// =============================================================================

/** Must match TableCell: h-10, with the border included in the row height. */
const COMPLETED_ROW_HEIGHT_REM = 2.5

const completedTable = useTemplateRef<InstanceType<typeof Table>>('completedTable')

const completedVirtualizer = useVirtualizer(
  computed(() => {
    const scrollElement = completedTable.value?.scrollElement ?? null
    const rowHeight = remToPx(COMPLETED_ROW_HEIGHT_REM)
    return {
      count: filteredCompletedRuns.value.length,
      getScrollElement: () => scrollElement,
      estimateSize: () => rowHeight,
      overscan: 8
    }
  })
)

const completedVirtualRows = computed(() => completedVirtualizer.value.getVirtualItems())
const completedVisibleRuns = computed(() =>
  completedVirtualRows.value.map((virtualRow) => filteredCompletedRuns.value[virtualRow.index]!)
)
const completedPadTop = computed(() => completedVirtualRows.value[0]?.start ?? 0)
const completedPadBottom = computed(() => {
  const lastRow = completedVirtualRows.value.at(-1)
  return completedVirtualizer.value.getTotalSize() - (lastRow?.end ?? 0)
})
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
    <DialogContent
      size="xl"
      fill
    >
      <DialogHeader>
        <DialogTitle>{{ m.task.center }}</DialogTitle>
      </DialogHeader>

      <DialogBody class="overflow-hidden p-0">
        <Tabs
          v-model="selectedTab"
          class="flex h-full flex-col gap-0 overflow-hidden"
        >
          <!-- Band shared by both tabs: the scope row, then the selected tab's query row -->
          <Toolbar>
            <ToolbarRow>
              <TabsList class="shrink-0">
                <TabsTrigger value="active">{{ m.task.tabActive }} ({{ activeCount }})</TabsTrigger>
                <TabsTrigger value="completed">
                  {{ m.task.tabCompleted }} ({{ completedCount }})
                </TabsTrigger>
              </TabsList>
            </ToolbarRow>

            <ActiveTaskRunToolbar
              v-if="selectedTab === 'active'"
              v-model:search="activeSearch"
              v-model:category="activeCategoryFilter"
              v-model:status="activeStatusFilter"
              :filtered-count="filteredActiveRuns.length"
            />
            <CompletedTaskRunToolbar
              v-else
              v-model:search="completedSearch"
              v-model:category="completedCategoryFilter"
              v-model:status="completedStatusFilter"
              :filtered-count="filteredCompletedRuns.length"
            />
          </Toolbar>

          <div
            v-if="error"
            class="shrink-0 border-b border-border bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {{ error }}
          </div>

          <TabsContent
            value="active"
            class="m-0 min-h-0 flex-1 overflow-hidden"
          >
            <div class="flex h-full flex-col">
              <div class="min-h-0 flex-1">
                <StateView
                  v-if="filteredActiveRuns.length === 0"
                  state="empty"
                  icon="icon-[mdi--playlist-play]"
                  :description="m.task.noActiveTasks"
                  class="h-full min-h-48"
                />
                <Table
                  v-else
                  fixed-header
                  inset
                  :columns="activeColumns"
                  min-width="48rem"
                >
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
              <div class="min-h-0 flex-1">
                <StateView
                  v-if="filteredCompletedRuns.length === 0"
                  state="empty"
                  icon="icon-[mdi--archive-outline]"
                  :description="m.task.noCompletedRecords"
                  class="h-full min-h-48"
                />
                <div
                  v-else
                  class="h-full"
                >
                  <Table
                    ref="completedTable"
                    fixed-header
                    inset
                    :columns="completedColumns"
                    min-width="48rem"
                  >
                    <TableBody>
                      <tr
                        v-if="completedPadTop > 0"
                        aria-hidden="true"
                        :style="{ height: `${completedPadTop}px` }"
                      />
                      <CompletedTaskRunRow
                        v-for="run in completedVisibleRuns"
                        :key="run.id"
                        :run="run"
                        @details="openCompletedDetailsDialog"
                        @delete="handleDeleteCompleted"
                      />
                      <tr
                        v-if="completedPadBottom > 0"
                        aria-hidden="true"
                        :style="{ height: `${completedPadBottom}px` }"
                      />
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogBody>

      <!-- Dialog-global operations live in the footer, independent of the active tab -->
      <DialogFooter>
        <Button
          variant="outline"
          :disabled="completedCount === 0 || clearing"
          @click="handleClearCompleted"
        >
          <Icon
            icon="icon-[mdi--trash-can-outline]"
            class="size-4"
          />
          {{ m.task.toolbar.clearCompleted }}
        </Button>
        <Button
          variant="outline"
          :disabled="refreshing"
          @click="handleRefresh"
        >
          <Icon
            icon="icon-[mdi--refresh]"
            :class="cn('size-4', refreshing && 'animate-spin')"
          />
          {{ m.task.toolbar.refresh }}
        </Button>
      </DialogFooter>
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
