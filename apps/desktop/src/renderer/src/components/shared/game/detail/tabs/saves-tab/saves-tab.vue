<!--
  Game Saves Tab

  Saves tab content showing save backup list with management actions.
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { useGame } from '@renderer/composables/use-game'
import { ipcManager } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import { Button } from '@renderer/components/ui/button'
import { StateView } from '@renderer/components/ui/state-view'
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
import { DeleteConfirmDialog } from '@renderer/components/ui/delete-confirm-dialog'
import type { SaveBackup } from '@shared/db/contracts/json'
import { GameSavesFormDialog } from '../../../forms'
import GameDetailSavesItem from './saves-item.vue'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const { game, refetch } = useGame()

const isCreating = ref(false)
const restoreTarget = ref<number | null>(null)
const deleteTarget = ref<number | null>(null)
const editTarget = ref<SaveBackup | null>(null)
const editDialogOpen = ref(false)

const backups = computed(() => game.value?.saveBackups || [])
const hasSavePath = computed(() => !!game.value?.savePath)
const sortedBackups = computed(() => [...backups.value].sort((a, b) => b.backupAt - a.backupAt))

// Dialog open states derived from target values
const restoreDialogOpen = computed({
  get: () => restoreTarget.value !== null,
  set: (v) => {
    if (!v) restoreTarget.value = null
  }
})
const deleteDialogOpen = computed({
  get: () => deleteTarget.value !== null,
  set: (v) => {
    if (!v) deleteTarget.value = null
  }
})

const editFormInitialData = computed(() => {
  if (!editTarget.value) return undefined
  return { note: editTarget.value.note, locked: editTarget.value.locked }
})

async function handleCreate() {
  if (!game.value) return
  isCreating.value = true
  try {
    const result = await ipcManager.invoke('attachment:create-game-save-backup', game.value.id)
    if (result.success) {
      notify.success(m.value.game.saves.backupCreated)
      refetch()
    } else {
      notify.error(m.value.game.saves.createBackupFailed, result.error)
    }
  } finally {
    isCreating.value = false
  }
}

async function handleRestore(backupAt: number) {
  if (!game.value) return
  const result = await ipcManager.invoke(
    'attachment:restore-game-save-backup',
    game.value.id,
    backupAt
  )
  if (result.success) {
    notify.success(m.value.game.saves.restored)
    refetch()
  } else {
    notify.error(m.value.game.saves.restoreFailed, result.error)
  }
  restoreTarget.value = null
}

async function handleDelete(backupAt: number) {
  if (!game.value) return
  const result = await ipcManager.invoke(
    'attachment:delete-game-save-backup',
    game.value.id,
    backupAt
  )
  if (result.success) {
    notify.success(m.value.game.saves.backupDeleted)
    refetch()
  } else {
    notify.error(result.error || m.value.game.saves.deleteBackupFailed)
  }
  deleteTarget.value = null
}

async function handleOpenBackupFolder() {
  if (!game.value) return
  await ipcManager.invoke('attachment:open-save-backup-folder', game.value.id)
}

async function handleOpenSaveFolder() {
  if (!game.value) return
  await ipcManager.invoke('attachment:open-save-folder', game.value.id)
}

function openEditDialog(backup: SaveBackup) {
  editTarget.value = backup
  editDialogOpen.value = true
}

async function handleEditSubmit(data: { note: string; locked: boolean }) {
  if (!game.value || !editTarget.value) return
  try {
    const result = await ipcManager.invoke(
      'attachment:update-game-save-backup',
      game.value.id,
      editTarget.value.backupAt,
      data
    )
    if (result.success) {
      notify.success(m.value.game.saves.backupInfoUpdated)
      editDialogOpen.value = false
      editTarget.value = null
      refetch()
    } else {
      notify.error(result.error || m.value.library.feedback.updateFailed)
    }
  } catch {
    notify.error(m.value.library.feedback.updateFailed)
  }
}
</script>

<template>
  <template v-if="game">
    <!-- No save path configured -->
    <StateView
      v-if="!hasSavePath"
      state="empty"
      icon="icon-[mdi--folder-search-outline]"
      :title="m.game.saves.noSavePathTitle"
      :description="m.game.saves.noSavePathHint"
      class="py-12"
    />

    <!-- Empty state -->
    <StateView
      v-else-if="!backups.length"
      state="empty"
      icon="icon-[mdi--content-save-outline]"
      :title="m.game.saves.emptyBackupsTitle"
      :description="m.game.saves.emptyBackupsHint"
      class="py-12"
    >
      <template #actions>
        <Button
          :disabled="isCreating"
          @click="handleCreate"
        >
          <Icon
            v-if="isCreating"
            icon="icon-[mdi--loading]"
            class="size-4 animate-spin mr-2"
          />
          <Icon
            v-else
            icon="icon-[mdi--plus]"
            class="size-4 mr-2"
          />
          {{ m.game.saves.createBackup }}
        </Button>
      </template>
    </StateView>

    <!-- Backup list -->
    <template v-else>
      <div class="space-y-3">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Button
              size="sm"
              :disabled="isCreating"
              @click="handleCreate"
            >
              <Icon
                v-if="isCreating"
                icon="icon-[mdi--loading]"
                class="size-4 animate-spin mr-1.5"
              />
              <Icon
                v-else
                icon="icon-[mdi--plus]"
                class="size-4 mr-1.5"
              />
              {{ m.game.saves.createBackup }}
            </Button>
            <span class="text-xs text-muted-foreground">
              {{ m.game.saves.backupCount({ current: backups.length, max: game.maxSaveBackups }) }}
            </span>
          </div>
          <div class="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              @click="handleOpenSaveFolder"
            >
              <Icon
                icon="icon-[mdi--folder-open-outline]"
                class="size-4 mr-1.5"
              />
              {{ m.game.saves.saveDir }}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              @click="handleOpenBackupFolder"
            >
              <Icon
                icon="icon-[mdi--folder-zip-outline]"
                class="size-4 mr-1.5"
              />
              {{ m.game.saves.backupDir }}
            </Button>
          </div>
        </div>

        <!-- Backup list -->
        <div class="rounded-md border divide-y overflow-hidden">
          <GameDetailSavesItem
            v-for="backup in sortedBackups"
            :key="backup.backupAt"
            :note="backup.note"
            :backup-at="backup.backupAt"
            :size-bytes="backup.sizeBytes"
            :locked="backup.locked"
            @restore="restoreTarget = backup.backupAt"
            @edit="openEditDialog(backup)"
            @delete="deleteTarget = backup.backupAt"
          />
        </div>
      </div>

      <!-- Edit backup dialog -->
      <GameSavesFormDialog
        v-if="editDialogOpen"
        v-model:open="editDialogOpen"
        :initial-data="editFormInitialData"
        @submit="handleEditSubmit"
      />

      <!-- Restore confirmation dialog -->
      <AlertDialog v-model:open="restoreDialogOpen">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{{ m.game.saves.restoreTitle }}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>
            {{ m.game.saves.restoreDescription }}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{{ m.common.cancel }}</AlertDialogCancel>
            <AlertDialogAction @click="restoreTarget && handleRestore(restoreTarget)">
              {{ m.game.saves.confirmRestore }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <!-- Delete confirmation dialog -->
      <DeleteConfirmDialog
        v-if="deleteDialogOpen"
        v-model:open="deleteDialogOpen"
        :entity-label="m.game.saves.backupEntityLabel"
        @confirm="deleteTarget && handleDelete(deleteTarget)"
      />
    </template>
  </template>
</template>
