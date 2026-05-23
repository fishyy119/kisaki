<!--
Extension Repository Panel manages distributed extension repositories.
Boundary: calls repository IPC only; renderer never fetches manifests directly.
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Spinner } from '@renderer/components/ui/spinner'
import { notify } from '@renderer/core/notify'
import { ipcManager, unwrapIpcData, unwrapIpcVoid } from '@renderer/core/ipc'
import { useAsyncData, useRenderState } from '@renderer/composables'
import RepositoryAddDialog from './repository-add-dialog.vue'
import RepositoryDetailsDialog from './repository-details-dialog.vue'
import RepositoryPanelRow from './repository-panel-row.vue'
import RepositoryRemoveDialog from './repository-remove-dialog.vue'
import type { RepositoryAddRequest } from './types'
import { OFFICIAL_EXTENSION_REPOSITORY_URL, type ExtensionRepositoryInfo } from '@shared/extension'

const addDialogOpen = ref(false)
const submitting = ref(false)
const refreshingAll = ref(false)
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

async function handleRefreshAll() {
  refreshingAll.value = true
  try {
    const results = unwrapIpcData(await ipcManager.invoke('extension:refresh-repositories'))
    const failed = results.filter((result) => result.status === 'failed')
    if (failed.length > 0) {
      notify.error('部分仓库刷新失败', `${failed.length} 个仓库返回错误`)
    } else {
      notify.success('仓库已刷新')
    }
    refetch()
  } catch (err) {
    notify.error('刷新仓库失败', err instanceof Error ? err.message : String(err))
  } finally {
    refreshingAll.value = false
  }
}

async function handleRefreshRepository(repository: ExtensionRepositoryInfo) {
  await withRepositoryBusy(repository.id, async () => {
    const result = unwrapIpcData(
      await ipcManager.invoke('extension:refresh-repository', repository.id)
    )
    if (result.status === 'failed') {
      notify.error('仓库刷新失败', result.error ?? '未知错误')
    } else {
      notify.success(result.status === 'not-modified' ? '仓库未变化' : '仓库已刷新')
    }
    refetch()
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
      <!-- Official repository publishing is not available yet. Keep this visible but inactive. -->
      <Button
        v-if="!hasOfficialRepository"
        variant="outline"
        size="sm"
        disabled
      >
        <Icon
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

    <div class="flex-1 overflow-auto scrollbar-thin">
      <template v-if="state === 'loading'">
        <div class="flex items-center justify-center h-48">
          <Spinner class="size-6" />
        </div>
      </template>

      <template v-else-if="repositoryList.length === 0">
        <div class="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <Icon
            icon="icon-[mdi--source-branch]"
            class="size-16 mb-3 opacity-30"
          />
          <p class="font-medium">暂无扩展仓库</p>
        </div>
      </template>

      <template v-else>
        <div class="divide-y divide-border">
          <RepositoryPanelRow
            v-for="(repository, index) in repositoryList"
            :key="repository.id"
            :repository="repository"
            :priority-label="index + 1"
            :busy="busyRepositoryIds.has(repository.id)"
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
      :removing="busyRepositoryIds.has(repositoryToRemove.id)"
      @confirm="handleConfirmRemoveRepository"
    />
  </div>
</template>
