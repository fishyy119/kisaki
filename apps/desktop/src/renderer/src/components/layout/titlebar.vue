<!--
  Titlebar
  Desktop-style titlebar with window controls.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Icon } from '@renderer/components/ui/icon'
import { ipcManager } from '@renderer/core/ipc'
import { useIpc } from '@renderer/composables/use-ipc'
import { UpdaterDialog } from '@renderer/features/updater'
import { useUpdaterStore } from '@renderer/stores'
import kisakiIcon from '@assets/icon-32.png'

const isMaximized = ref(false)
const isUpdaterDialogOpen = ref(false)

const updaterStore = useUpdaterStore()
const { hasDownloadedUpdate, release } = storeToRefs(updaterStore)

const updateButtonTitle = computed(() => {
  if (!release.value) return '更新已下载'
  return `发现新版本 v${release.value.version}`
})

useIpc('native:main-window-maximized', () => {
  isMaximized.value = true
})

useIpc('native:main-window-unmaximized', () => {
  isMaximized.value = false
})

function handleMinimizeMainWindow() {
  ipcManager.invoke('window:minimize-main-window')
}

function handleToggleMaximizeMainWindow() {
  ipcManager.invoke('window:toggle-main-window-maximize')
}

async function handleCloseMainWindow() {
  await ipcManager.invoke('window:close-main-window')
}

function handleOpenUpdaterDialog() {
  isUpdaterDialogOpen.value = true
}
</script>

<template>
  <header
    class="relative pointer-events-auto flex items-center h-9 bg-surface text-surface-foreground border-b border-border select-none shrink-0"
    style="-webkit-app-region: drag"
  >
    <!-- Left section: Brand -->
    <div
      class="flex items-center gap-2 px-3 h-full"
      style="-webkit-app-region: no-drag"
    >
      <img
        :src="kisakiIcon"
        alt="Kisaki Icon"
        class="w-[18px] h-[18px] border border-border rounded-md"
      />
    </div>

    <!-- Spacer - draggable area -->
    <div class="flex-1" />

    <!-- Right section: Window controls -->
    <div
      class="flex items-center h-full"
      style="-webkit-app-region: no-drag"
    >
      <button
        v-if="hasDownloadedUpdate"
        class="relative pointer-events-auto inline-flex items-center justify-center gap-1.5 h-5.5 px-2 mr-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
        :title="updateButtonTitle"
        @click="handleOpenUpdaterDialog"
      >
        <Icon
          icon="icon-[mdi--update]"
          class="size-4"
        />
        <span>有可用的更新</span>
      </button>
      <button
        class="relative pointer-events-auto flex items-center justify-center w-12 h-full hover:bg-accent transition-colors"
        @click="handleMinimizeMainWindow"
      >
        <Icon
          icon="icon-[mdi--minus]"
          class="size-4"
        />
      </button>
      <button
        class="relative pointer-events-auto flex items-center justify-center w-12 h-full hover:bg-accent transition-colors"
        @click="handleToggleMaximizeMainWindow"
      >
        <Icon
          :icon="isMaximized ? 'icon-[mdi--window-restore]' : 'icon-[mdi--window-maximize]'"
          class="size-4"
        />
      </button>
      <button
        class="relative pointer-events-auto flex items-center justify-center w-12 h-full hover:bg-destructive hover:text-destructive-foreground transition-colors"
        @click="handleCloseMainWindow"
      >
        <Icon
          icon="icon-[mdi--close]"
          class="size-4"
        />
      </button>
    </div>
  </header>

  <UpdaterDialog
    v-if="isUpdaterDialogOpen"
    v-model:open="isUpdaterDialogOpen"
  />
</template>
