<!--
Extension Repository Panel manages distributed extension repositories.
Boundary: calls repository IPC only; renderer never fetches manifests directly.
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Spinner } from '@renderer/components/ui/spinner'
import { StateView } from '@renderer/components/ui/state-view'
import { notify } from '@renderer/core/notify'
import { ipcManager, unwrapIpcData, unwrapIpcVoid } from '@renderer/core/ipc'
import { useAsyncData, useRenderState } from '@renderer/composables'
import { useTaskRunStore } from '@renderer/stores'
import RepositoryAddDialog from './repository-add-dialog.vue'
import RepositoryDetailsDialog from './repository-details-dialog.vue'
import RepositoryPanelRow from './repository-panel-row.vue'
import RepositoryRemoveDialog from './repository-remove-dialog.vue'
import type { RepositoryAddRequest } from './types'
import {
  OFFICIAL_EXTENSION_REPOSITORY_NAME,
  OFFICIAL_EXTENSION_REPOSITORY_URL,
  type ExtensionRepositoryInfo
} from '@shared/extension'

const addDialogOpen = ref(false)
const submitting = ref(false)
const addingOfficialRepository = ref(false)
const startingRefreshAll = ref(false)
const busyRepositoryIds = ref(new Set<string>())
const detailsDialogOpen = ref(false)
const removeDialogOpen = ref(false)
const selectedRepositoryId = ref<string | null>(null)
const repositoryToRemove = ref<ExtensionRepositoryInfo | null>(null)

const {
  data: repositories,
  isLoading,
  error,
  refetch
} = useAsyncData(
  async () => unwrapIpcData(await ipcManager.invoke('extension:list-repositories')),
  { immediate: true }
)
const state = useRenderState(isLoading, error, repositories, { preset: 'network' })
const repositoryList = computed(() =>
  [...(repositories.value ?? [])].sort((left, right) => left.priority - right.priority)
)
const taskRunStore = useTaskRunStore()
const activeRefreshAll = computed(() =>
  taskRunStore.activeRuns.some((run) => run.operation === 'extension.repository.refreshAll')
)
const activeRefreshRepositoryIds = computed(() => {
  const ids = new Set<string>()
  for (const run of taskRunStore.activeRuns) {
    if (
      run.operation === 'extension.repository.refresh' &&
      run.subject?.type === 'repository' &&
      run.subject.id
    ) {
      ids.add(run.subject.id)
    }
  }
  return ids
})
const refreshingAll = computed(() => startingRefreshAll.value || activeRefreshAll.value)
const hasOfficialRepository = computed(() =>
  repositoryList.value.some((repository) => repository.url === OFFICIAL_EXTENSION_REPOSITORY_URL)
)
const selectedRepository = computed(
  () =>
    repositoryList.value.find((repository) => repository.id === selectedRepositoryId.value) ?? null
)
const selectedRepositoryPriority = computed(() =>
  selectedRepository.value ? getRepositoryIndex(selectedRepository.value) + 1 : 0
)

let unsubscribeRepositoriesChanged: (() => void) | null = null

onMounted(() => {
  unsubscribeRepositoriesChanged = ipcManager.on('extension:repositories-changed', () => {
    refetch()
  })
})

onUnmounted(() => {
  unsubscribeRepositoriesChanged?.()
})

watch(detailsDialogOpen, (open) => {
  if (!open) {
    selectedRepositoryId.value = null
  }
})

watch(removeDialogOpen, (open) => {
  if (!open) {
    repositoryToRemove.value = null
  }
})

async function handleAddRepository(request: RepositoryAddRequest) {
  submitting.value = true
  try {
    await ipcManager
      .invoke('extension:add-repository', {
        url: request.url,
        name: request.name
      })
      .then(unwrapIpcData)

    notify.success('仓库已添加')
    addDialogOpen.value = false
    refetch()
  } catch (err) {
    notify.error('添加仓库失败', err instanceof Error ? err.message : String(err))
  } finally {
    submitting.value = false
  }
}

async function handleAddOfficialRepository() {
  addingOfficialRepository.value = true
  try {
    await ipcManager
      .invoke('extension:add-repository', {
        url: OFFICIAL_EXTENSION_REPOSITORY_URL,
        name: OFFICIAL_EXTENSION_REPOSITORY_NAME
      })
      .then(unwrapIpcData)

    notify.success('官方仓库已添加')
    refetch()
  } catch (err) {
    notify.error('添加官方仓库失败', err instanceof Error ? err.message : String(err))
  } finally {
    addingOfficialRepository.value = false
  }
}

async function handleRefreshAll() {
  startingRefreshAll.value = true
  try {
    unwrapIpcData(await ipcManager.invoke('extension:refresh-repositories'))
    notify.success('已开始刷新扩展仓库')
  } catch (err) {
    notify.error('刷新仓库失败', err instanceof Error ? err.message : String(err))
  } finally {
    startingRefreshAll.value = false
  }
}

async function handleRefreshRepository(repository: ExtensionRepositoryInfo) {
  await withRepositoryBusy(repository.id, async () => {
    unwrapIpcData(await ipcManager.invoke('extension:refresh-repository', repository.id))
    notify.success('已开始刷新仓库')
  })
}

async function handleToggleRepository(repository: ExtensionRepositoryInfo, enabled: boolean) {
  await withRepositoryBusy(repository.id, async () => {
    await ipcManager
      .invoke('extension:update-repository', {
        id: repository.id,
        state: enabled ? 'enabled' : 'disabled'
      })
      .then(unwrapIpcData)
    notify.success(enabled ? '仓库已启用' : '仓库已禁用')
    refetch()
  })
}

async function handleMovePriority(repository: ExtensionRepositoryInfo, delta: number) {
  const currentIndex = getRepositoryIndex(repository)
  const nextIndex = currentIndex + delta
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= repositoryList.value.length) {
    return
  }

  await withRepositoryBusy(repository.id, async () => {
    await ipcManager
      .invoke('extension:update-repository', {
        id: repository.id,
        priority: nextIndex
      })
      .then(unwrapIpcData)
    refetch()
  })
}

function openRemoveDialog(repository: ExtensionRepositoryInfo) {
  repositoryToRemove.value = repository
  removeDialogOpen.value = true
}

async function handleConfirmRemoveRepository() {
  const repository = repositoryToRemove.value
  if (!repository) {
    return
  }

  setRepositoryBusy(repository.id, true)
  try {
    unwrapIpcVoid(await ipcManager.invoke('extension:remove-repository', repository.id))
    notify.success('仓库已删除')
    removeDialogOpen.value = false
    repositoryToRemove.value = null
    refetch()
  } catch (err) {
    notify.error('仓库操作失败', err instanceof Error ? err.message : String(err))
  } finally {
    setRepositoryBusy(repository.id, false)
  }
}

function handleOpenDetails(repository: ExtensionRepositoryInfo) {
  selectedRepositoryId.value = repository.id
  detailsDialogOpen.value = true
}

async function withRepositoryBusy(repositoryId: string, run: () => Promise<void>) {
  setRepositoryBusy(repositoryId, true)
  try {
    await run()
  } catch (err) {
    notify.error('仓库操作失败', err instanceof Error ? err.message : String(err))
  } finally {
    setRepositoryBusy(repositoryId, false)
  }
}

function setRepositoryBusy(repositoryId: string, busy: boolean) {
  const next = new Set(busyRepositoryIds.value)
  if (busy) {
    next.add(repositoryId)
  } else {
    next.delete(repositoryId)
  }
  busyRepositoryIds.value = next
}

function isRepositoryBusy(repository: ExtensionRepositoryInfo): boolean {
  return (
    busyRepositoryIds.value.has(repository.id) ||
    activeRefreshAll.value ||
    activeRefreshRepositoryIds.value.has(repository.id)
  )
}

function getRepositoryIndex(repository: ExtensionRepositoryInfo): number {
  return repositoryList.value.findIndex((item) => item.id === repository.id)
}

function canMoveRepository(repository: ExtensionRepositoryInfo, delta: number): boolean {
  const currentIndex = getRepositoryIndex(repository)
  const nextIndex = currentIndex + delta
  return currentIndex >= 0 && nextIndex >= 0 && nextIndex < repositoryList.value.length
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border bg-background/50">
      <div class="flex-1">
        <div class="text-sm font-medium">扩展仓库</div>
        <div class="text-xs text-muted-foreground">
          {{ repositoryList.length }} 个仓库，按优先级聚合发现目录
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        :disabled="refreshingAll"
        @click="handleRefreshAll"
      >
        <Spinner
          v-if="refreshingAll"
          class="size-4"
        />
        <Icon
          v-else
          icon="icon-[mdi--refresh]"
          class="size-4"
        />
        刷新全部
      </Button>
      <Button
        v-if="!hasOfficialRepository"
        variant="outline"
        size="sm"
        :disabled="addingOfficialRepository"
        @click="handleAddOfficialRepository"
      >
        <Spinner
          v-if="addingOfficialRepository"
          class="size-4"
        />
        <Icon
          v-else
          icon="icon-[mdi--shield-plus-outline]"
          class="size-4"
        />
        添加官方仓库
      </Button>
      <Button
        variant="outline"
        size="sm"
        @click="addDialogOpen = true"
      >
        <Icon
          icon="icon-[mdi--plus]"
          class="size-4"
        />
        添加仓库
      </Button>
    </div>

    <div class="flex-1 overflow-auto">
      <StateView
        v-if="state === 'loading'"
        state="loading"
        class="h-48"
      />

      <StateView
        v-else-if="repositoryList.length === 0"
        state="empty"
        icon="icon-[mdi--source-branch]"
        title="暂无扩展仓库"
        class="h-48"
      />

      <template v-else>
        <div class="divide-y divide-border">
          <RepositoryPanelRow
            v-for="(repository, index) in repositoryList"
            :key="repository.id"
            :repository="repository"
            :priority-label="index + 1"
            :busy="isRepositoryBusy(repository)"
            :can-move-up="canMoveRepository(repository, -1)"
            :can-move-down="canMoveRepository(repository, 1)"
            @details="handleOpenDetails"
            @toggle="handleToggleRepository"
            @refresh="handleRefreshRepository"
            @move="handleMovePriority"
            @remove="openRemoveDialog"
          />
        </div>
      </template>
    </div>

    <RepositoryAddDialog
      v-model:open="addDialogOpen"
      :submitting="submitting"
      @submit="handleAddRepository"
    />

    <RepositoryDetailsDialog
      v-if="detailsDialogOpen && selectedRepository"
      v-model:open="detailsDialogOpen"
      :repository="selectedRepository"
      :priority-label="selectedRepositoryPriority"
    />

    <RepositoryRemoveDialog
      v-if="removeDialogOpen && repositoryToRemove"
      v-model:open="removeDialogOpen"
      :repository="repositoryToRemove"
      :removing="isRepositoryBusy(repositoryToRemove)"
      @confirm="handleConfirmRemoveRepository"
    />
  </div>
</template>
