<!--
  EntityAssetsFormDialog
  Dialog for managing an entity's image assets: left sidebar slot selector +
  right preview/actions. Entity differences arrive via the asset spec.
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { ipcManager } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import { getOpenImageDialogOptions } from '@renderer/utils/dialog'
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
import { useI18n } from '@renderer/composables/use-i18n'
import type { TableEntityType } from '../entity-tables'
import { ENTITY_ASSET_SPECS } from './asset-specs'
import AssetSearchFormDialog from './asset-search-form-dialog.vue'
import AssetCropFormDialog from './asset-crop-form-dialog.vue'
import AssetUrlFormDialog from './asset-url-form-dialog.vue'

const { m } = useI18n()

interface Props {
  entityType: TableEntityType
  entityId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const spec = computed(() => ENTITY_ASSET_SPECS[props.entityType])

const selectedType = ref(spec.value.slots[0].type)

// Sub-dialog states
const showSearchDialog = ref(false)
const showCropDialog = ref(false)
const showUrlDialog = ref(false)
const showDeleteConfirm = ref(false)

// Loading states
const isImportingFile = ref(false)

const {
  data: entry,
  isLoading,
  refetch
} = useAsyncData(() => spec.value.loadEntry(props.entityId), {
  watch: [() => props.entityId],
  enabled: () => open.value
})

// Listen for entity updates
useDbChanges(({ operation, table, id }) => {
  if (operation !== 'updated') return
  if (table === spec.value.attachmentTable && id === props.entityId) {
    refetch()
  }
})

const selectedSlot = computed(() =>
  spec.value.slots.find((slot) => slot.type === selectedType.value)!
)

const currentFile = computed(() => {
  if (!entry.value) return null
  return entry.value.files[selectedSlot.value.type]
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

    await spec.value.setFile(props.entityId, selectedSlot.value.type, {
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
  await spec.value.clearFile(props.entityId, selectedSlot.value.type)
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
      <template v-if="isLoading || !entry">
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
          <!-- Slot Selector - Left Sidebar -->
          <div class="w-28 shrink-0 space-y-1">
            <button
              v-for="slot in spec.slots"
              :key="slot.type"
              :class="
                cn(
                  'w-full flex flex-col items-center gap-1.5 p-2 rounded-md text-left transition-colors',
                  selectedType === slot.type
                    ? 'bg-primary/20 text-primary'
                    : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
                )
              "
              @click="selectedType = slot.type"
            >
              <!-- Thumbnail -->
              <div
                :class="
                  cn(
                    'w-full rounded border bg-muted flex items-center justify-center overflow-hidden',
                    slot.aspectClass
                  )
                "
              >
                <img
                  v-if="entry.files[slot.type]"
                  :src="`attachment://${spec.attachmentTable}/${props.entityId}/${entry.files[slot.type]}`"
                  :alt="slot.label(m)"
                  class="size-full object-cover"
                />
                <Icon
                  v-else
                  icon="icon-[mdi--image-off-outline]"
                  class="size-4 text-muted-foreground/50"
                />
              </div>
              <span class="text-xs font-medium">{{ slot.label(m) }}</span>
            </button>
          </div>

          <!-- Preview and Actions - Right Panel -->
          <div class="flex-1 min-w-0 space-y-4">
            <!-- Preview -->
            <div
              :class="
                cn(
                  'w-full rounded-lg border bg-muted/50 flex items-center justify-center overflow-hidden',
                  selectedSlot.aspectClass,
                  'max-h-[300px]'
                )
              "
            >
              <img
                v-if="hasImage && currentFile"
                :src="`attachment://${spec.attachmentTable}/${props.entityId}/${currentFile}`"
                :alt="selectedSlot.label(m)"
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
                  m.library.forms.emptyMedia({ label: selectedSlot.label(m) })
                }}</span>
              </div>
            </div>

            <!-- Description -->
            <p class="text-xs text-muted-foreground">{{ selectedSlot.description(m) }}</p>

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
              <template v-if="hasImage && currentFile">
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
  <AssetSearchFormDialog
    v-if="showSearchDialog"
    v-model:open="showSearchDialog"
    :entity-type="props.entityType"
    :entity-id="props.entityId"
    :slot-type="selectedType"
  />

  <!-- Crop Dialog -->
  <AssetCropFormDialog
    v-if="showCropDialog && hasImage && currentFile"
    v-model:open="showCropDialog"
    :entity-type="props.entityType"
    :entity-id="props.entityId"
    :slot-type="selectedType"
    :current-file-name="currentFile"
  />

  <!-- URL Import Dialog -->
  <AssetUrlFormDialog
    v-if="showUrlDialog"
    v-model:open="showUrlDialog"
    :entity-type="props.entityType"
    :entity-id="props.entityId"
    :slot-type="selectedType"
  />

  <!-- Delete Confirmation -->
  <DeleteConfirmDialog
    v-if="showDeleteConfirm"
    v-model:open="showDeleteConfirm"
    :entity-label="m.library.forms.imageEntityLabel"
    :entity-name="selectedSlot.label(m)"
    @confirm="handleDelete"
  />
</template>
