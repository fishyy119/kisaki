<!--
  Comic Chapters Tab

  Unit list with read state and the file toolbar (files configuration, sync,
  manual unit creation). Units render at their own grain: collected volumes
  and serialized chapters share one ordered list.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { Section } from '@renderer/components/ui/section'
import { StateView } from '@renderer/components/ui/state-view'
import { VirtualList } from '@renderer/components/ui/virtual'
import { useComicFileSync } from '@renderer/composables'
import { useComic } from '@renderer/composables/use-comic'
import { toggleChapterRead } from '@renderer/composables/comic-completion'
import { useI18n } from '@renderer/composables/use-i18n'
import { cn } from '@renderer/utils/cn'
import { notify } from '@renderer/core/notify'
import { ipcManager } from '@renderer/core/ipc'
import { ComicFilesConfigFormDialog } from '../../../forms'
import ComicChapterDetailDialog from './chapter-detail-dialog.vue'
import ComicDetailChapterItem from './chapter-item.vue'
import ComicChapterFormDialog from './chapter-form-dialog.vue'

const { comic, chapters } = useComic()
const { m } = useI18n()
const { isSyncing, syncFiles } = useComicFileSync()

const addDialogOpen = ref(false)
const filesConfigOpen = ref(false)
const detailChapterId = ref<string | null>(null)

const readCount = computed(() => chapters.value.filter((chapter) => chapter.read).length)

const canSyncFiles = computed(() => !!comic.value?.dirPath)

const detailDialogOpen = computed({
  get: () => detailChapterId.value !== null,
  set: (value) => {
    if (!value) detailChapterId.value = null
  }
})

async function handleSyncFiles(): Promise<void> {
  const current = comic.value
  if (!current) return
  if (!current.dirPath) {
    notify.error(m.value.comic.detail.comicDirNotSet)
    return
  }

  await syncFiles(current.id)
}

async function handleOpenFolder(path: string): Promise<void> {
  const result = await ipcManager.invoke('native:open-path', { path, ensure: 'file' })
  if (!result.success) {
    notify.error(m.value.comic.files.openFolderFailed)
  }
}
</script>

<template>
  <div
    v-if="comic"
    class="space-y-6"
  >
    <Section :title="m.comic.chapters.title">
      <template #actions>
        <div class="flex items-center gap-2">
          <span class="text-xs text-muted-foreground">
            {{ m.comic.chapters.progress({ read: readCount, total: chapters.length }) }}
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
            {{ m.comic.chapters.addChapter }}
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
            {{ m.comic.filesConfig.title }}
          </Button>

          <Button
            variant="outline"
            size="sm"
            :disabled="!canSyncFiles || isSyncing"
            :tooltip="canSyncFiles ? undefined : m.comic.detail.comicDirNotSet"
            @click="handleSyncFiles"
          >
            <Icon
              :icon="isSyncing ? 'icon-[mdi--loading]' : 'icon-[mdi--folder-sync-outline]'"
              :class="cn('size-4 mr-1.5', isSyncing && 'animate-spin')"
            />
            {{ m.comic.chapters.syncFiles }}
          </Button>
        </div>
      </template>

      <StateView
        v-if="chapters.length === 0"
        state="empty"
        icon="icon-[mdi--thought-bubble-outline]"
        :title="m.comic.chapters.emptyTitle"
        :description="m.comic.chapters.emptyHint"
        class="py-10"
      />
      <!-- Long serializations can carry 1000+ chapters, so rows virtualize -->
      <div
        v-else
        class="rounded-md border overflow-hidden"
      >
        <VirtualList
          :items="chapters"
          :get-key="(chapter) => chapter.id"
          scroll-parent="auto"
          class="flex flex-col"
        >
          <template #item="{ item: chapter, index }">
            <div :class="index < chapters.length - 1 ? 'border-b' : undefined">
              <ComicDetailChapterItem
                :chapter="chapter"
                @toggle-read="toggleChapterRead(chapter)"
                @open-folder="handleOpenFolder"
                @show-detail="detailChapterId = chapter.id"
              />
            </div>
          </template>
        </VirtualList>
      </div>
    </Section>

    <!-- Create unit dialog -->
    <ComicChapterFormDialog
      v-if="addDialogOpen"
      v-model:open="addDialogOpen"
      :comic-id="comic.id"
    />

    <!-- Unit workbench dialog -->
    <ComicChapterDetailDialog
      v-if="detailChapterId"
      v-model:open="detailDialogOpen"
      :comic-id="comic.id"
      :chapter-id="detailChapterId"
    />

    <!-- Files configuration dialog -->
    <ComicFilesConfigFormDialog
      v-if="filesConfigOpen"
      v-model:open="filesConfigOpen"
      :comic-id="comic.id"
    />
  </div>
</template>
