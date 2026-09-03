<!--
Repository Panel Actions render the repositories route's header operations:
refresh all, the official repository shortcut, and adding a repository (the
add dialog lives here with its button). Mounted only while the repositories
route is active; the panel owns the list and its row operations.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Spinner } from '@renderer/components/ui/spinner'
import { notify } from '@renderer/core/notify'
import { ipcManager, unwrapIpcData } from '@renderer/core/ipc'
import { useTaskRunStore } from '@renderer/stores'
import { useI18n } from '@renderer/composables/use-i18n'
import { extensionRepositoriesData } from '../../composables'
import RepositoryAddDialog from './repository-add-dialog.vue'
import type { RepositoryAddRequest } from './types'
import {
  OFFICIAL_EXTENSION_REPOSITORY_NAME,
  OFFICIAL_EXTENSION_REPOSITORY_URL
} from '@shared/extension'

const { m } = useI18n()

const addDialogOpen = ref(false)
const submitting = ref(false)
const addingOfficialRepository = ref(false)
const startingRefreshAll = ref(false)

// Adding a repository reaches the list through the resource's declared
// repository-change event; nothing here refetches by hand.
const { data: repositories } = extensionRepositoriesData()

const taskRunStore = useTaskRunStore()
const activeRefreshAll = computed(() =>
  taskRunStore.activeRuns.some((run) => run.operation === 'extension.repository.refreshAll')
)
const refreshingAll = computed(() => startingRefreshAll.value || activeRefreshAll.value)
const hasOfficialRepository = computed(() =>
  (repositories.value ?? []).some(
    (repository) => repository.url === OFFICIAL_EXTENSION_REPOSITORY_URL
  )
)

async function handleRefreshAll() {
  startingRefreshAll.value = true
  try {
    unwrapIpcData(await ipcManager.invoke('extension:refresh-repositories'))
    notify.success(m.value.extension.repository.refreshAllStarted)
  } catch (err) {
    notify.error(
      m.value.extension.repository.refreshFailed,
      err instanceof Error ? err.message : String(err)
    )
  } finally {
    startingRefreshAll.value = false
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

    notify.success(m.value.extension.repository.officialAdded)
  } catch (err) {
    notify.error(
      m.value.extension.repository.officialAddFailed,
      err instanceof Error ? err.message : String(err)
    )
  } finally {
    addingOfficialRepository.value = false
  }
}

async function handleAddRepository(request: RepositoryAddRequest) {
  submitting.value = true
  try {
    await ipcManager
      .invoke('extension:add-repository', {
        url: request.url,
        name: request.name
      })
      .then(unwrapIpcData)

    notify.success(m.value.extension.repository.added)
    addDialogOpen.value = false
  } catch (err) {
    notify.error(
      m.value.extension.repository.addFailed,
      err instanceof Error ? err.message : String(err)
    )
  } finally {
    submitting.value = false
  }
}
</script>

<template>
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
    {{ m.extension.repository.refreshAll }}
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
    {{ m.extension.repository.addOfficial }}
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
    {{ m.extension.repository.add }}
  </Button>

  <RepositoryAddDialog
    v-model:open="addDialogOpen"
    :submitting="submitting"
    @submit="handleAddRepository"
  />
</template>
