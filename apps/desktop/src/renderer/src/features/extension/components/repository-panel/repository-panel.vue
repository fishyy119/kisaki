<!--
Extension Repository Panel manages distributed extension repositories: the
priority-ordered list and its row operations. Panel-level operations (refresh
all, add) live in the header actions component.
Boundary: calls repository IPC only; renderer never fetches manifests directly.
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { StateView } from '@renderer/components/ui/state-view'
import { notify } from '@renderer/core/notify'
import { ipcManager, unwrapIpcData, unwrapIpcVoid } from '@renderer/core/ipc'
import { useTaskRunStore } from '@renderer/stores'
import { useI18n } from '@renderer/composables/use-i18n'
import { extensionRepositoriesData } from '../../composables'
import RepositoryDetailsDialog from './repository-details-dialog.vue'
import RepositoryPanelRow from './repository-panel-row.vue'
import RepositoryRemoveDialog from './repository-remove-dialog.vue'
import type { ExtensionRepositoryInfo } from '@shared/extension'

const { m } = useI18n()
const busyRepositoryIds = ref(new Set<string>())
const detailsDialogOpen = ref(false)
const removeDialogOpen = ref(false)
const selectedRepositoryId = ref<string | null>(null)
const repositoryToRemove = ref<ExtensionRepositoryInfo | null>(null)

// Data settled during navigation by the route loader
const { data: repositories, error, refetch } = extensionRepositoriesData()
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

async function handleRefreshRepository(repository: ExtensionRepositoryInfo) {
  await withRepositoryBusy(repository.id, async () => {
    unwrapIpcData(await ipcManager.invoke('extension:refresh-repository', repository.id))
    notify.success(m.value.extension.repository.refreshStarted)
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
    notify.success(
      enabled
        ? m.value.extension.repository.enabledFeedback
        : m.value.extension.repository.disabledFeedback
    )
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
    notify.success(m.value.extension.repository.deleted)
    removeDialogOpen.value = false
    repositoryToRemove.value = null
    refetch()
  } catch (err) {
    notify.error(
      m.value.extension.repository.operationFailed,
      err instanceof Error ? err.message : String(err)
    )
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
    notify.error(
      m.value.extension.repository.operationFailed,
      err instanceof Error ? err.message : String(err)
    )
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
    <div class="flex-1 overflow-auto">
      <StateView
        v-if="error"
        state="error"
        :error="error"
        class="h-48"
      />

      <StateView
        v-else-if="repositoryList.length === 0"
        state="empty"
        icon="icon-[mdi--source-branch]"
        :title="m.extension.repository.emptyTitle"
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
