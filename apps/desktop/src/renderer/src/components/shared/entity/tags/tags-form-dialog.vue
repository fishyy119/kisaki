<!--
  EntityTagsFormDialog
  Dialog for editing an entity's tag links; entity differences arrive as the
  `entityType` registry key resolving to a storage adapter.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { nanoid } from 'nanoid'
import { Icon } from '@renderer/components/ui/icon'
import { queryEntityTagLinks, replaceEntityTagLinks } from '@renderer/core/db'
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
import { SpoilerConfirmDialog } from '@renderer/components/ui/spoiler-confirm-dialog'
import { Button } from '@renderer/components/ui/button'
import { ListItem, ListItemActions } from '@renderer/components/ui/list-item'
import { VirtualList } from '@renderer/components/ui/virtual'
import { notify } from '@renderer/core/notify'
import { getEntityIcon, getSpoilerDisplay } from '@renderer/utils/format'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'
import type { ContentEntityType } from '@shared/common'
import EntityTagItemFormDialog from './tag-item-form-dialog.vue'

const { m } = useI18n()

const log = createLogger('Library')

interface Props {
  entityType: ContentEntityType
  entityId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

interface TagItem {
  id: string
  tagId: string
  tagName: string
  note: string
  isSpoiler: boolean
  isNew?: boolean
}

// Form state
const items = ref<TagItem[]>([])
const editingItem = ref<TagItem | null>(null)
const isAddMode = ref(false)
const deleteIndex = ref<number | null>(null)
const isSaving = ref(false)
const itemFormOpen = ref(false)
const spoilersRevealed = ref(false)
const spoilerConfirmOpen = ref(false)

watch(
  () => open.value,
  (isOpen) => {
    if (!isOpen) {
      spoilersRevealed.value = false
      spoilerConfirmOpen.value = false
    }
  }
)

const { data: results, isLoading } = useAsyncData(
  () => queryEntityTagLinks(props.entityType, props.entityId),
  {
    watch: [() => props.entityId],
    enabled: () => open.value
  }
)

watch(results, (data) => {
  if (data) {
    items.value = data.map((row) => ({
      id: row.id,
      tagId: row.tagId,
      tagName: row.tagName,
      note: row.note || '',
      isSpoiler: row.isSpoiler
    }))
  }
})

const existingTagIds = computed(() => items.value.map((item) => item.tagId))

const displayItems = computed(() =>
  items.value.map((item) => ({
    item,
    spoiler: getSpoilerDisplay(item.tagName, item.note, item.isSpoiler, spoilersRevealed.value)
  }))
)

const deleteDialogOpen = computed({
  get: () => deleteIndex.value !== null,
  set: (v) => {
    if (!v) deleteIndex.value = null
  }
})

const itemFormInitialData = computed(() => {
  if (!editingItem.value || isAddMode.value) return undefined
  return {
    tagId: editingItem.value.tagId,
    tagName: editingItem.value.tagName,
    note: editingItem.value.note,
    isSpoiler: editingItem.value.isSpoiler
  }
})

async function handleSave() {
  isSaving.value = true
  try {
    await replaceEntityTagLinks(
      props.entityType,
      props.entityId,
      items.value.map((item) => ({
        id: item.isNew ? nanoid() : item.id,
        tagId: item.tagId,
        note: item.note || null,
        isSpoiler: item.isSpoiler
      }))
    )

    notify.success(m.value.common.saved)
    open.value = false
  } catch (error) {
    log.error('Save failed:', error)
    notify.error(m.value.library.feedback.saveFailedRetry)
  } finally {
    isSaving.value = false
  }
}

function handleMoveUp(index: number) {
  if (index <= 0) return
  const temp = items.value[index - 1]!
  items.value[index - 1] = items.value[index]!
  items.value[index] = temp
}

function handleMoveDown(index: number) {
  if (index >= items.value.length - 1) return
  const temp = items.value[index]!
  items.value[index] = items.value[index + 1]!
  items.value[index + 1] = temp
}

function handleRemove(index: number) {
  items.value.splice(index, 1)
  deleteIndex.value = null
}

function handleEdit(item: TagItem) {
  editingItem.value = { ...item }
  isAddMode.value = false
  itemFormOpen.value = true
}

function handleAddNew() {
  editingItem.value = {
    id: nanoid(),
    tagId: '',
    tagName: '',
    note: '',
    isSpoiler: false,
    isNew: true
  }
  isAddMode.value = true
  itemFormOpen.value = true
}

function handleItemFormSubmit(data: {
  tagId: string
  tagName: string
  note: string
  isSpoiler: boolean
}) {
  const updatedItem: TagItem = {
    id: editingItem.value!.id,
    tagId: data.tagId,
    tagName: data.tagName,
    note: data.note,
    isSpoiler: data.isSpoiler,
    isNew: editingItem.value!.isNew
  }

  if (isAddMode.value) {
    items.value.push(updatedItem)
  } else {
    const index = items.value.findIndex((item) => item.id === updatedItem.id)
    if (index !== -1) {
      items.value[index] = updatedItem
    }
  }

  itemFormOpen.value = false
  editingItem.value = null
  isAddMode.value = false
}

function handleCancel() {
  open.value = false
}

function handleToggleSpoilers() {
  if (spoilersRevealed.value) {
    spoilersRevealed.value = false
    return
  }
  spoilerConfirmOpen.value = true
}

function handleRevealSpoilersConfirm() {
  spoilersRevealed.value = true
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <!-- Loading state -->
      <template v-if="isLoading || !results">
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
          <DialogTitle>{{ m.library.forms.editTags }}</DialogTitle>
        </DialogHeader>
        <DialogBody class="overflow-auto max-h-[60vh]">
          <StateView
            v-if="items.length === 0"
            state="empty"
            :description="m.library.forms.emptyTagsHint"
            class="py-8"
          />
          <!-- An entry can carry hundreds of tag links, so rows virtualize -->
          <VirtualList
            v-else
            :items="displayItems"
            :get-key="(entry) => entry.item.id"
            scroll-parent="auto"
            class="flex flex-col gap-1"
          >
            <template #item="{ item: { item, spoiler }, index }">
              <ListItem
                :icon="spoiler.hidden ? 'icon-[mdi--eye-off-outline]' : getEntityIcon('tag')"
                :title="spoiler.name"
                :description="spoiler.note"
              >
                <template
                  v-if="!spoiler.hidden"
                  #actions
                >
                  <ListItemActions
                    movable
                    :is-first="index === 0"
                    :is-last="index === items.length - 1"
                    @move-up="handleMoveUp(index)"
                    @move-down="handleMoveDown(index)"
                    @edit="handleEdit(item)"
                    @delete="deleteIndex = index"
                  />
                </template>
              </ListItem>
            </template>
          </VirtualList>
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
            {{ m.library.forms.addTag }}
          </Button>
          <div class="flex gap-2">
            <Button
              variant="outline"
              @click="handleToggleSpoilers"
            >
              <Icon
                :icon="spoilersRevealed ? 'icon-[mdi--eye-off-outline]' : 'icon-[mdi--eye-outline]'"
                class="size-4 mr-1.5"
              />
              {{ spoilersRevealed ? m.library.forms.hideSpoilers : m.library.forms.showSpoilers }}
            </Button>
            <Button
              variant="outline"
              @click="handleCancel"
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

  <!-- Delete confirmation dialog -->
  <DeleteConfirmDialog
    v-if="deleteDialogOpen"
    v-model:open="deleteDialogOpen"
    :entity-label="m.library.forms.linkLabels.tag"
    mode="remove"
    @confirm="deleteIndex !== null && handleRemove(deleteIndex)"
  />

  <!-- Tag item form dialog -->
  <EntityTagItemFormDialog
    v-if="itemFormOpen"
    v-model:open="itemFormOpen"
    :initial-data="itemFormInitialData"
    :exclude-ids="existingTagIds"
    @submit="handleItemFormSubmit"
  />

  <SpoilerConfirmDialog
    v-if="spoilerConfirmOpen"
    v-model:open="spoilerConfirmOpen"
    @confirm="handleRevealSpoilersConfirm"
  />
</template>
