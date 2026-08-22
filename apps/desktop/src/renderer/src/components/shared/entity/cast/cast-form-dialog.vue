<!--
  EntityCastFormDialog
  Editor for an entry's voice cast: the set of (character, person) pairs this
  entry credits. Saving replaces the whole set, so a recast reads as the removal
  and addition it is.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { nanoid } from 'nanoid'
import { Icon } from '@renderer/components/ui/icon'
import { useAsyncData } from '@renderer/composables'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { StateView } from '@renderer/components/ui/state-view'
import { DeleteConfirmDialog } from '@renderer/components/ui/delete-confirm-dialog'
import { Button } from '@renderer/components/ui/button'
import { ListItem, ListItemActions } from '@renderer/components/ui/list-item'
import { CoverImage } from '@renderer/components/ui/cover-image'
import { notify } from '@renderer/core/notify'
import { createLogger } from '@renderer/core/log'
import { getEntityAttachmentUrl } from '@renderer/utils/entity-image'
import { useI18n } from '@renderer/composables/use-i18n'
import type { MediaType } from '@shared/common'
import { CAST_SPECS, type CastRow } from './cast-specs'
import CastItemFormDialog, { type CastItemData } from './cast-item-form-dialog.vue'

const { m } = useI18n()

const log = createLogger('Library')

interface Props {
  mediaType: MediaType
  entityId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const spec = computed(() => CAST_SPECS[props.mediaType])

interface CastItem extends CastItemData {
  id: string
}

const items = ref<CastItem[]>([])
const editingItem = ref<CastItem | null>(null)
const isAddMode = ref(false)
const itemFormOpen = ref(false)
const deleteId = ref<string | null>(null)
const isSaving = ref(false)

const { data: results, isLoading } = useAsyncData(() => spec.value.list(props.entityId), {
  watch: [() => props.entityId, () => props.mediaType],
  enabled: () => open.value
})

watch(results, (rows) => {
  if (rows) {
    items.value = rows.map(toItem)
  }
})

const existingPairs = computed(() =>
  items.value
    .filter((item) => item.id !== editingItem.value?.id)
    .map((item) => `${item.characterId}:${item.personId}`)
)

const deleteDialogOpen = computed({
  get: () => deleteId.value !== null,
  set: (value) => {
    if (!value) deleteId.value = null
  }
})

const itemFormInitialData = computed(() =>
  editingItem.value && !isAddMode.value ? { ...editingItem.value } : undefined
)

function toItem(row: CastRow): CastItem {
  return {
    id: row.id,
    characterId: row.characterId,
    characterName: row.characterName,
    characterImage: row.characterImage,
    personId: row.personId,
    personName: row.personName,
    personImage: row.personImage,
    note: row.note ?? ''
  }
}

function characterImageUrl(item: CastItem): string | null {
  return item.characterImage
    ? getEntityAttachmentUrl('character', item.characterId, item.characterImage, {
        width: 80,
        height: 80
      })
    : null
}

function handleAddNew() {
  editingItem.value = {
    id: nanoid(),
    characterId: '',
    characterName: '',
    characterImage: null,
    personId: '',
    personName: '',
    personImage: null,
    note: ''
  }
  isAddMode.value = true
  itemFormOpen.value = true
}

function handleEdit(item: CastItem) {
  editingItem.value = { ...item }
  isAddMode.value = false
  itemFormOpen.value = true
}

function handleRemove(id: string) {
  items.value = items.value.filter((item) => item.id !== id)
  deleteId.value = null
}

function handleItemFormSubmit(data: CastItemData) {
  const updated: CastItem = { ...data, id: editingItem.value!.id }
  if (isAddMode.value) {
    items.value = [...items.value, updated]
  } else {
    const index = items.value.findIndex((item) => item.id === updated.id)
    if (index !== -1) items.value[index] = updated
  }

  itemFormOpen.value = false
  editingItem.value = null
  isAddMode.value = false
}

async function handleSave() {
  isSaving.value = true
  try {
    await spec.value.replace(
      props.entityId,
      items.value.map((item) => ({
        id: item.id,
        characterId: item.characterId,
        personId: item.personId,
        note: item.note || null
      }))
    )
    notify.success(m.value.common.saved)
    open.value = false
  } catch (error) {
    log.error('Cast save failed:', error)
    notify.error(m.value.library.feedback.saveFailedRetry)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <template v-if="isLoading || !results">
        <DialogBody>
          <StateView
            state="loading"
            class="py-8"
          />
        </DialogBody>
      </template>

      <template v-else>
        <DialogHeader>
          <DialogTitle>{{ m.library.fields.cast }}</DialogTitle>
        </DialogHeader>
        <DialogBody class="overflow-auto max-h-[60vh]">
          <p
            v-if="items.length === 0"
            class="text-sm text-muted-foreground text-center py-8"
          >
            {{ m.library.forms.castEmptyHint }}
          </p>
          <div
            v-else
            class="space-y-1"
          >
            <ListItem
              v-for="item in items"
              :key="item.id"
              icon="icon-[mdi--ghost-outline]"
              :title="item.characterName"
              :description="item.note || item.personName"
            >
              <template
                v-if="characterImageUrl(item)"
                #leading
              >
                <CoverImage
                  :src="characterImageUrl(item)!"
                  :alt="item.characterName"
                  class="size-10 shrink-0 rounded-md border shadow-raised"
                />
              </template>
              <template #actions>
                <ListItemActions
                  @edit="handleEdit(item)"
                  @delete="deleteId = item.id"
                />
              </template>
            </ListItem>
          </div>
        </DialogBody>
        <DialogFooter class="flex justify-between">
          <Button
            variant="outline"
            @click="handleAddNew"
          >
            <Icon
              icon="icon-[mdi--plus]"
              class="size-4 mr-1.5"
            />
            {{ m.library.detail.addEntity({ label: m.library.fields.cast }) }}
          </Button>
          <div class="flex gap-2">
            <Button
              variant="outline"
              :disabled="isSaving"
              @click="open = false"
            >
              {{ m.common.cancel }}
            </Button>
            <Button
              :disabled="isSaving"
              @click="handleSave"
            >
              {{ m.common.save }}
            </Button>
          </div>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>

  <CastItemFormDialog
    v-if="itemFormOpen"
    v-model:open="itemFormOpen"
    :initial-data="itemFormInitialData"
    :existing-pairs="existingPairs"
    @submit="handleItemFormSubmit"
  />

  <DeleteConfirmDialog
    v-model:open="deleteDialogOpen"
    :entity-label="m.library.fields.cast"
    @confirm="deleteId && handleRemove(deleteId)"
  />
</template>
