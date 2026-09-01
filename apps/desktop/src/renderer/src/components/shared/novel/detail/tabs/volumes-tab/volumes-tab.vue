<!--
  Novel Volumes Tab

  Volume list with read state and the file toolbar (files configuration,
  sync, manual volume creation).
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { Section } from '@renderer/components/ui/section'
import { StateView } from '@renderer/components/ui/state-view'
import { VirtualList } from '@renderer/components/ui/virtual'
import { useNovelFileSync } from '@renderer/composables'
import { useNovel } from '@renderer/composables/use-novel'
import { toggleVolumeRead } from '@renderer/composables/use-novel-read'
import { useI18n } from '@renderer/composables/use-i18n'
import { cn } from '@renderer/utils/cn'
import { notify } from '@renderer/core/notify'
import { ipcManager } from '@renderer/core/ipc'
import { NovelFilesConfigFormDialog } from '../../../forms'
import NovelVolumeDetailDialog from './volume-detail-dialog.vue'
import NovelDetailVolumeItem from './volume-item.vue'
import NovelVolumeFormDialog from './volume-form-dialog.vue'

const { novel, volumes } = useNovel()
const { m } = useI18n()
const { isSyncing, syncFiles } = useNovelFileSync()

const addDialogOpen = ref(false)
const filesConfigOpen = ref(false)
const detailVolumeId = ref<string | null>(null)

const readCount = computed(() => volumes.value.filter((volume) => volume.read).length)

const canSyncFiles = computed(() => !!novel.value?.novelDirPath)

const detailDialogOpen = computed({
  get: () => detailVolumeId.value !== null,
  set: (value) => {
    if (!value) detailVolumeId.value = null
  }
})

async function handleSyncFiles(): Promise<void> {
  const current = novel.value
  if (!current) return
  if (!current.novelDirPath) {
    notify.error(m.value.novel.detail.novelDirNotSet)
    return
  }

  await syncFiles(current.id)
}

async function handleOpenFolder(path: string): Promise<void> {
  const result = await ipcManager.invoke('native:open-path', { path, ensure: 'file' })
  if (!result.success) {
    notify.error(m.value.novel.files.openFolderFailed)
  }
}
</script>

<template>
  <div
    v-if="novel"
    class="space-y-6"
  >
    <Section :title="m.novel.volumes.title">
      <template #actions>
        <div class="flex items-center gap-2">
          <span class="text-xs text-muted-foreground">
            {{ m.novel.volumes.progress({ read: readCount, total: volumes.length }) }}
          </span>

          <Button
            variant="outline"
            size="sm"
            @click="addDialogOpen = true"
          >
            <Icon
              icon="icon-[mdi--plus]"
              class="size-4 mr-1.5"
            />
            {{ m.novel.volumes.addVolume }}
          </Button>

          <Button
            variant="outline"
            size="sm"
            @click="filesConfigOpen = true"
          >
            <Icon
              icon="icon-[mdi--folder-cog-outline]"
              class="size-4 mr-1.5"
            />
            {{ m.novel.filesConfig.title }}
          </Button>

          <Button
            variant="outline"
            size="sm"
            :disabled="!canSyncFiles || isSyncing"
            :tooltip="canSyncFiles ? undefined : m.novel.detail.novelDirNotSet"
            @click="handleSyncFiles"
          >
            <Icon
              :icon="isSyncing ? 'icon-[mdi--loading]' : 'icon-[mdi--folder-sync-outline]'"
              :class="cn('size-4 mr-1.5', isSyncing && 'animate-spin')"
            />
            {{ m.novel.volumes.syncFiles }}
          </Button>
        </div>
      </template>

      <StateView
        v-if="volumes.length === 0"
        state="empty"
        icon="icon-[mdi--book-open-blank-variant-outline]"
        :title="m.novel.volumes.emptyTitle"
        :description="m.novel.volumes.emptyHint"
        class="py-10"
      />
      <!-- Long series can carry hundreds of volumes, so rows virtualize -->
      <div
        v-else
        class="rounded-md border overflow-hidden"
      >
        <VirtualList
          :items="volumes"
          :get-key="(volume) => volume.id"
          scroll-parent="auto"
          class="flex flex-col"
        >
          <template #item="{ item: volume, index }">
            <div :class="index < volumes.length - 1 ? 'border-b' : undefined">
              <NovelDetailVolumeItem
                :volume="volume"
                @toggle-read="toggleVolumeRead(volume)"
                @open-folder="handleOpenFolder"
                @show-detail="detailVolumeId = volume.id"
              />
            </div>
          </template>
        </VirtualList>
      </div>
    </Section>

    <!-- Create volume dialog -->
    <NovelVolumeFormDialog
      v-if="addDialogOpen"
      v-model:open="addDialogOpen"
      :novel-id="novel.id"
    />

    <!-- Volume workbench dialog -->
    <NovelVolumeDetailDialog
      v-if="detailVolumeId"
      v-model:open="detailDialogOpen"
      :novel-id="novel.id"
      :volume-id="detailVolumeId"
    />

    <!-- Files configuration dialog -->
    <NovelFilesConfigFormDialog
      v-if="filesConfigOpen"
      v-model:open="filesConfigOpen"
      :novel-id="novel.id"
    />
  </div>
</template>
