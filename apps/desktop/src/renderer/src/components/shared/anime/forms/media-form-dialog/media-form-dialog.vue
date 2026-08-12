<!--
  AnimeMediaFormDialog
  Dialog for managing anime media (cover, backdrop, logo).
  Uses two-layer pattern: outer handles data fetching, inner handles form state.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { db, attachment } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import { getOpenImageDialogOptions } from '@renderer/utils/dialog'
import { animes, type Anime } from '@shared/db'
import type { AnimeMediaType } from '@shared/attachment'
import { useAsyncData, useDbChanges } from '@renderer/composables'
import { cn } from '@renderer/utils/cn'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { StateView } from '@renderer/components/ui/state-view'
import { Button } from '@renderer/components/ui/button'
import { DeleteConfirmDialog } from '@renderer/components/ui/delete-confirm-dialog'
import AnimeMediaSearchFormDialog from './media-search-form-dialog.vue'
import AnimeMediaCropFormDialog from './media-crop-form-dialog.vue'
import AnimeMediaUrlFormDialog from './media-url-form-dialog.vue'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

interface Props {
  animeId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

interface MediaTypeConfig {
  type: AnimeMediaType
  label: string
  description: string
  aspectRatio: string
  field: 'coverFile' | 'backdropFile' | 'logoFile'
}

const MEDIA_TYPES = computed<MediaTypeConfig[]>(() => [
  {
    type: 'cover',
    label: m.value.library.forms.mediaTypes.cover,
    description: m.value.library.forms.mediaDescriptions.animeCover,
    aspectRatio: 'aspect-[3/4]',
    field: 'coverFile'
  },
  {
    type: 'backdrop',
    label: m.value.library.forms.mediaTypes.backdrop,
    description: m.value.library.forms.mediaDescriptions.animeBackdrop,
    aspectRatio: 'aspect-video',
    field: 'backdropFile'
  },
  {
    type: 'logo',
    label: m.value.library.forms.mediaTypes.logo,
    description: m.value.library.forms.mediaDescriptions.animeLogo,
    aspectRatio: 'aspect-[3/1]',
    field: 'logoFile'
  }
])

// Content state
const anime = ref<Anime | null>(null)
const selectedType = ref<AnimeMediaType>('cover')

// Sub-dialog states
const showSearchDialog = ref(false)
const showCropDialog = ref(false)
const showUrlDialog = ref(false)
const showDeleteConfirm = ref(false)

// Loading states
const isImportingFile = ref(false)

// Fetch anime when dialog opens
const {
  data: fetchedAnime,
  isLoading,
  refetch
} = useAsyncData(() => db.query.animes.findFirst({ where: eq(animes.id, props.animeId) }), {
  watch: [() => props.animeId],
  enabled: () => open.value
})

// Initialize anime ref when data loads
watch(fetchedAnime, (data) => {
  anime.value = data ?? null
})

// Listen for anime updates
useDbChanges(({ operation, table, id }) => {
  if (operation !== 'updated') return
  if (table === 'animes' && id === props.animeId) {
    refetch()
  }
})

const selectedConfig = computed(() =>
  MEDIA_TYPES.value.find((mt) => mt.type === selectedType.value)!
)

const currentFile = computed(() => {
  if (!anime.value) return null
  return anime.value[selectedConfig.value.field]
})

const hasImage = computed(() => !!currentFile.value)

// Import from file
async function handleImportFile() {
  isImportingFile.value = true

  try {
    const dialogResult = await ipcManager.invoke('native:open-dialog', getOpenImageDialogOptions())
    if (!dialogResult.success) {
      notify.error(dialogResult.error || m.value.library.feedback.pickFileFailed)
      return
    }
    if (!dialogResult.data || dialogResult.data.canceled || !dialogResult.data.filePaths[0]) {
      return
    }

    await attachment.setFile(animes, props.animeId, selectedConfig.value.field, {
      kind: 'path',
      path: dialogResult.data.filePaths[0]
    })

    notify.success(m.value.library.forms.mediaUpdated)
  } finally {
    isImportingFile.value = false
  }
}

// Delete media
async function handleDelete() {
  await attachment.clearFile(animes, props.animeId, selectedConfig.value.field)
  notify.success(m.value.library.forms.mediaDeleted)
}

function handleClose() {
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-2xl">
      <!-- Loading state -->
      <template v-if="isLoading || !anime">
        <DialogBody>
          <StateView
            state="loading"
            class="py-8"
          />
        </DialogBody>
      </template>

      <!-- Form content -->
      <template v-else>
        <DialogHeader>
          <DialogTitle>{{ m.library.forms.manageMedia }}</DialogTitle>
        </DialogHeader>

        <DialogBody class="flex gap-4">
          <!-- Media Type Selector - Left Sidebar -->
          <div class="w-28 shrink-0 space-y-1">
            <button
              v-for="media in MEDIA_TYPES"
              :key="media.type"
              :class="
                cn(
                  'w-full flex flex-col items-center gap-1.5 p-2 rounded-md text-left transition-colors',
                  selectedType === media.type
                    ? 'bg-primary/20 text-primary'
                    : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
                )
              "
              @click="selectedType = media.type"
            >
              <!-- Thumbnail -->
              <div
                :class="
                  cn(
                    'w-full rounded border bg-muted flex items-center justify-center overflow-hidden',
                    media.type === 'cover' && 'aspect-[3/4]',
                    media.type === 'backdrop' && 'aspect-video',
                    media.type === 'logo' && 'aspect-[3/1]'
                  )
                "
              >
                <img
                  v-if="anime[media.field]"
                  :src="`attachment://animes/${anime.id}/${anime[media.field]}`"
                  :alt="media.label"
                  class="size-full object-cover"
                />
                <Icon
                  v-else
                  icon="icon-[mdi--image-off-outline]"
                  class="size-4 text-muted-foreground/50"
                />
              </div>
              <span class="text-xs font-medium">{{ media.label }}</span>
            </button>
          </div>

          <!-- Preview and Actions - Right Panel -->
          <div class="flex-1 min-w-0 space-y-4">
            <!-- Preview -->
            <div
              :class="
                cn(
                  'w-full rounded-lg border bg-muted/50 flex items-center justify-center overflow-hidden',
                  selectedConfig.aspectRatio,
                  'max-h-[300px]'
                )
              "
            >
              <img
                v-if="hasImage"
                :src="`attachment://animes/${anime.id}/${currentFile}`"
                :alt="selectedConfig.label"
                class="size-full object-contain"
              />
              <div
                v-else
                class="flex flex-col items-center gap-2 text-muted-foreground"
              >
                <Icon
                  icon="icon-[mdi--image-off-outline]"
                  class="size-12"
                />
                <span class="text-sm">{{
                  m.library.forms.emptyMedia({ label: selectedConfig.label })
                }}</span>
              </div>
            </div>

            <!-- Description -->
            <p class="text-xs text-muted-foreground">{{ selectedConfig.description }}</p>

            <!-- Action Buttons -->
            <div class="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                :disabled="isImportingFile"
                @click="handleImportFile"
              >
                <Icon
                  v-if="isImportingFile"
                  icon="icon-[mdi--loading]"
                  class="size-4 animate-spin"
                />
                <Icon
                  v-else
                  icon="icon-[mdi--upload]"
                  class="size-4"
                />
                {{ m.library.forms.importFromFile }}
              </Button>
              <Button
                variant="outline"
                size="sm"
                @click="showUrlDialog = true"
              >
                <Icon
                  icon="icon-[mdi--link-variant]"
                  class="size-4"
                />
                {{ m.library.forms.importFromUrl }}
              </Button>
              <Button
                variant="outline"
                size="sm"
                @click="showSearchDialog = true"
              >
                <Icon
                  icon="icon-[mdi--magnify]"
                  class="size-4"
                />
                {{ m.library.forms.searchImages }}
              </Button>
              <template v-if="hasImage">
                <Button
                  variant="outline"
                  size="sm"
                  @click="showCropDialog = true"
                >
                  <Icon
                    icon="icon-[mdi--crop]"
                    class="size-4"
                  />
                  {{ m.library.forms.crop }}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  class="text-destructive hover:text-destructive"
                  @click="showDeleteConfirm = true"
                >
                  <Icon
                    icon="icon-[mdi--delete-outline]"
                    class="size-4"
                  />
                  {{ m.common.delete }}
                </Button>
              </template>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            @click="handleClose"
          >
            {{ m.common.close }}
          </Button>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>

  <!-- Search Dialog -->
  <AnimeMediaSearchFormDialog
    v-if="showSearchDialog"
    v-model:open="showSearchDialog"
    :anime-id="props.animeId"
    :media-type="selectedType"
  />

  <!-- Crop Dialog -->
  <AnimeMediaCropFormDialog
    v-if="showCropDialog && hasImage && currentFile"
    v-model:open="showCropDialog"
    :anime-id="props.animeId"
    :media-type="selectedType"
    :current-file-name="currentFile"
  />

  <!-- URL Import Dialog -->
  <AnimeMediaUrlFormDialog
    v-if="showUrlDialog"
    v-model:open="showUrlDialog"
    :anime-id="props.animeId"
    :media-type="selectedType"
  />

  <!-- Delete Confirmation -->
  <DeleteConfirmDialog
    v-if="showDeleteConfirm"
    v-model:open="showDeleteConfirm"
    :entity-label="m.library.forms.imageEntityLabel"
    :entity-name="selectedConfig.label"
    @confirm="handleDelete"
  />
</template>
