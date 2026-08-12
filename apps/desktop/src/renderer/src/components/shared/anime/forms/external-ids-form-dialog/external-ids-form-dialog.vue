<!--
  AnimeExternalIdsFormDialog
  Dialog for editing anime external IDs.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { nanoid } from 'nanoid'
import { eq, asc } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { db } from '@renderer/core/db'
import { animeExternalIds } from '@shared/db'
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
import { notify } from '@renderer/core/notify'
import { ListItem, ListItemActions } from '@renderer/components/ui/list-item'
import AnimeExternalIdItemFormDialog from './external-id-item-form-dialog.vue'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const log = createLogger('Anime')

interface Props {
  animeId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

interface ExternalIdItem {
  id: string
  source: string
  externalId: string
  orderInAnime: number
  isNew?: boolean
}

const items = ref<ExternalIdItem[]>([])
const editingItem = ref<ExternalIdItem | null>(null)
const isAddMode = ref(false)
const deleteId = ref<string | null>(null)
const isSaving = ref(false)
const itemFormOpen = ref(false)

const { data: results, isLoading } = useAsyncData(
  () =>
    db
      .select()
      .from(animeExternalIds)
      .where(eq(animeExternalIds.animeId, props.animeId))
      .orderBy(asc(animeExternalIds.orderInAnime)),
  {
    watch: [() => props.animeId],
    enabled: () => open.value
  }
)

watch(results, (data) => {
  if (!data) return

  items.value = data.map((item) => ({
    id: item.id,
    source: item.source,
    externalId: item.externalId,
    orderInAnime: item.orderInAnime
  }))
})

const deleteDialogOpen = computed({
  get: () => deleteId.value !== null,
  set: (v) => {
    if (!v) deleteId.value = null
  }
})

const itemFormInitialData = computed(() => {
  if (!editingItem.value || isAddMode.value) return undefined
  return {
    source: editingItem.value.source,
    externalId: editingItem.value.externalId
  }
})

async function handleSave() {
  isSaving.value = true

  try {
    const normalizedItems = items.value.map((item) => ({
      ...item,
      source: item.source.trim(),
      externalId: item.externalId.trim()
    }))

    const seen = new Set<string>()
    for (const item of normalizedItems) {
      if (!item.source || !item.externalId) {
        notify.error(m.value.library.forms.externalIdEmptyValues)
        return
      }
      const key = `${item.source}\u0000${item.externalId}`
      if (seen.has(key)) {
        notify.error(m.value.library.forms.externalIdDuplicates)
        return
      }
      seen.add(key)
    }

    await db.delete(animeExternalIds).where(eq(animeExternalIds.animeId, props.animeId))

    if (normalizedItems.length > 0) {
      await db.insert(animeExternalIds).values(
        normalizedItems.map((item, index) => ({
          id: item.isNew ? nanoid() : item.id,
          animeId: props.animeId,
          source: item.source,
          externalId: item.externalId,
          orderInAnime: index
        }))
      )
    }

    notify.success(m.value.common.saved)
    open.value = false
  } catch (error) {
    log.error('Save failed:', error)
    notify.error(m.value.library.forms.externalIdSaveFailed)
  } finally {
    isSaving.value = false
  }
}

function handleRemove(id: string) {
  items.value = items.value.filter((item) => item.id !== id)
  deleteId.value = null
}

function handleMoveUp(index: number) {
  if (index <= 0) return
  const temp = items.value[index - 1]
  items.value[index - 1] = items.value[index]
  items.value[index] = temp
}

function handleMoveDown(index: number) {
  if (index >= items.value.length - 1) return
  const temp = items.value[index]
  items.value[index] = items.value[index + 1]
  items.value[index + 1] = temp
}

function handleEdit(item: ExternalIdItem) {
  editingItem.value = { ...item }
  isAddMode.value = false
  itemFormOpen.value = true
}

function handleAddNew() {
  editingItem.value = {
    id: nanoid(),
    source: '',
    externalId: '',
    orderInAnime: items.value.length,
    isNew: true
  }
  isAddMode.value = true
  itemFormOpen.value = true
}

function handleItemFormSubmit(data: { source: string; externalId: string }) {
  const updatedItem: ExternalIdItem = {
    id: editingItem.value!.id,
    source: data.source,
    externalId: data.externalId,
    orderInAnime: editingItem.value!.orderInAnime,
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
          <DialogTitle>{{ m.library.forms.manageExternalIds }}</DialogTitle>
        </DialogHeader>
        <DialogBody class="overflow-auto max-h-[60vh]">
          <div class="space-y-1">
            <p
              v-if="items.length === 0"
              class="text-sm text-muted-foreground text-center py-8"
            >
              {{ m.library.forms.emptyExternalIdsHint }}
            </p>
            <ListItem
              v-for="(item, index) in items"
              :key="item.id"
              icon="icon-[mdi--card-text-outline]"
              :title="item.source.toUpperCase()"
              :description="item.externalId"
            >
              <template #actions>
                <ListItemActions
                  movable
                  :is-first="index === 0"
                  :is-last="index === items.length - 1"
                  @move-up="handleMoveUp(index)"
                  @move-down="handleMoveDown(index)"
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
            {{ m.library.forms.addExternalId }}
          </Button>
          <div class="flex gap-2">
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

  <DeleteConfirmDialog
    v-if="deleteDialogOpen"
    v-model:open="deleteDialogOpen"
    :entity-label="m.library.forms.linkLabels.externalId"
    mode="remove"
    @confirm="deleteId !== null && handleRemove(deleteId)"
  />

  <AnimeExternalIdItemFormDialog
    v-if="itemFormOpen"
    v-model:open="itemFormOpen"
    :initial-data="itemFormInitialData"
    @submit="handleItemFormSubmit"
  />
</template>
