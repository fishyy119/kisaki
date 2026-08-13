<!--
  MediaRelationsFormDialog
  Dialog for editing the outgoing media relations of one entry, grouped by
  relation type. Only out-edges are managed here; the other endpoint owns its
  own outgoing list, and readers merge both directions for display.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { Icon } from '@renderer/components/ui/icon'
import type { MediaType } from '@shared/common'
import {
  MEDIA_RELATION_TYPES,
  mediaRelations,
  type MediaRelationType,
  type NewMediaRelation
} from '@shared/db'
import { db } from '@renderer/core/db'
import { useAsyncData, useRenderState } from '@renderer/composables'
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
import { notify } from '@renderer/core/notify'
import { ListItem, ListItemActions } from '@renderer/components/ui/list-item'
import { getEntityIcon } from '@renderer/utils/format'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'
import RelationItemFormDialog, { type MediaRelationDraft } from './relation-item-form-dialog.vue'

const { m } = useI18n()

const log = createLogger('Library')

interface Props {
  mediaType: MediaType
  entityId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

interface RelationItem extends MediaRelationDraft {
  id: string
  isNew?: boolean
}

const RELATION_TYPE_LABELS = computed<Record<string, string>>(() => m.value.library.mediaRelation)

// Form state
const items = ref<RelationItem[]>([])
const editingItem = ref<RelationItem | null>(null)
const isAddMode = ref(false)
const deleteId = ref<string | null>(null)
const isSaving = ref(false)
const itemFormOpen = ref(false)

// Fetch outgoing relation rows when the dialog opens.
const {
  data: fetchedData,
  isLoading,
  error
} = useAsyncData(
  async () => {
    const rows = await db
      .select()
      .from(mediaRelations)
      .where(
        and(eq(mediaRelations.fromType, props.mediaType), eq(mediaRelations.fromId, props.entityId))
      )
      .orderBy(asc(mediaRelations.orderInFrom), asc(mediaRelations.createdAt))

    const gameIds = rows.filter((row) => row.toType === 'game').map((row) => row.toId)
    const animeIds = rows.filter((row) => row.toType === 'anime').map((row) => row.toId)
    const [gameRows, animeRows] = await Promise.all([
      gameIds.length
        ? db.query.games.findMany({ where: (t) => inArray(t.id, gameIds) })
        : Promise.resolve([]),
      animeIds.length
        ? db.query.animes.findMany({ where: (t) => inArray(t.id, animeIds) })
        : Promise.resolve([])
    ])
    const nameByKey = new Map<string, string>([
      ...gameRows.map((row) => [`game:${row.id}`, row.name] as const),
      ...animeRows.map((row) => [`anime:${row.id}`, row.name] as const)
    ])

    return rows.map(
      (row): RelationItem => ({
        id: row.id,
        targetType: row.toType,
        targetId: row.toId,
        targetName: nameByKey.get(`${row.toType}:${row.toId}`) ?? '',
        type: row.type,
        note: row.note ?? ''
      })
    )
  },
  {
    watch: [() => props.entityId],
    enabled: () => open.value
  }
)
const state = useRenderState(isLoading, error, fetchedData)

// Initialize form state when data loads.
watch(fetchedData, (data) => {
  items.value = data ? [...data] : []
})

const excludeGameIds = computed(() => [
  ...(props.mediaType === 'game' ? [props.entityId] : []),
  ...items.value.filter((item) => item.targetType === 'game').map((item) => item.targetId)
])

const excludeAnimeIds = computed(() => [
  ...(props.mediaType === 'anime' ? [props.entityId] : []),
  ...items.value.filter((item) => item.targetType === 'anime').map((item) => item.targetId)
])

const groupedItems = computed(() => {
  const groups = new Map<MediaRelationType, RelationItem[]>()
  for (const type of MEDIA_RELATION_TYPES) groups.set(type, [])
  for (const item of items.value) groups.get(item.type)!.push(item)
  return groups
})

async function handleSave() {
  isSaving.value = true
  try {
    await db
      .delete(mediaRelations)
      .where(
        and(eq(mediaRelations.fromType, props.mediaType), eq(mediaRelations.fromId, props.entityId))
      )

    if (items.value.length > 0) {
      let orderInFrom = 0
      const values: NewMediaRelation[] = []
      for (const type of MEDIA_RELATION_TYPES) {
        for (const item of groupedItems.value.get(type)!) {
          values.push({
            id: item.isNew ? nanoid() : item.id,
            fromType: props.mediaType,
            fromId: props.entityId,
            toType: item.targetType,
            toId: item.targetId,
            type: item.type,
            note: item.note || null,
            orderInFrom: orderInFrom++
          })
        }
      }
      await db.insert(mediaRelations).values(values)
    }

    notify.success(m.value.common.saved)
    open.value = false
  } catch (error) {
    log.error('Save failed:', error)
    notify.error(m.value.library.feedback.saveFailedRetry)
  } finally {
    isSaving.value = false
  }
}

function handleAddNew() {
  editingItem.value = null
  isAddMode.value = true
  itemFormOpen.value = true
}

function handleEdit(item: RelationItem) {
  editingItem.value = { ...item }
  isAddMode.value = false
  itemFormOpen.value = true
}

function handleItemFormSubmit(data: MediaRelationDraft) {
  if (isAddMode.value) {
    items.value.push({ ...data, id: nanoid(), isNew: true })
    return
  }
  const index = items.value.findIndex((item) => item.id === editingItem.value?.id)
  if (index !== -1) {
    items.value[index] = { ...items.value[index], ...data }
  }
}

function handleRemove(id: string) {
  items.value = items.value.filter((item) => item.id !== id)
  deleteId.value = null
}

function handleMove(type: MediaRelationType, index: number, offset: -1 | 1) {
  const groupItems = groupedItems.value.get(type)!
  const swapWith = index + offset
  if (swapWith < 0 || swapWith >= groupItems.length) return

  const indexA = items.value.findIndex((item) => item.id === groupItems[index].id)
  const indexB = items.value.findIndex((item) => item.id === groupItems[swapWith].id)
  if (indexA === -1 || indexB === -1) return
  ;[items.value[indexA], items.value[indexB]] = [items.value[indexB], items.value[indexA]]
}

const itemFormInitialData = computed(() =>
  editingItem.value && !isAddMode.value
    ? {
        targetType: editingItem.value.targetType,
        targetId: editingItem.value.targetId,
        targetName: editingItem.value.targetName,
        type: editingItem.value.type,
        note: editingItem.value.note
      }
    : undefined
)

const deleteDialogOpen = computed({
  get: () => deleteId.value !== null,
  set: (v) => {
    if (!v) deleteId.value = null
  }
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <template v-if="state === 'loading'">
        <DialogBody>
          <StateView
            state="loading"
            class="py-8"
          />
        </DialogBody>
      </template>

      <template v-else>
        <DialogHeader>
          <DialogTitle>{{ m.library.forms.editRelatedEntries }}</DialogTitle>
        </DialogHeader>
        <DialogBody class="overflow-auto max-h-[60vh]">
          <div
            v-if="items.length === 0"
            class="text-sm text-muted-foreground text-center py-8"
          >
            {{ m.library.forms.emptyListHint({ label: m.library.fields.relatedEntries }) }}
          </div>
          <div
            v-else
            class="space-y-2"
          >
            <template
              v-for="type in MEDIA_RELATION_TYPES"
              :key="type"
            >
              <div v-if="groupedItems.get(type)!.length > 0">
                <h4 class="text-xs font-medium text-muted-foreground mb-2">
                  {{ RELATION_TYPE_LABELS[type] }}
                </h4>
                <div class="space-y-1">
                  <ListItem
                    v-for="(item, index) in groupedItems.get(type)!"
                    :key="item.id"
                    :icon="getEntityIcon(item.targetType)"
                    :title="item.targetName"
                    :description="item.note || undefined"
                  >
                    <template #actions>
                      <ListItemActions
                        movable
                        :is-first="index === 0"
                        :is-last="index === groupedItems.get(type)!.length - 1"
                        @move-up="handleMove(type, index, -1)"
                        @move-down="handleMove(type, index, 1)"
                        @edit="handleEdit(item)"
                        @delete="deleteId = item.id"
                      />
                    </template>
                  </ListItem>
                </div>
              </div>
            </template>
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
            {{ m.library.detail.addEntity({ label: m.library.fields.relatedEntries }) }}
          </Button>
          <div class="flex gap-2">
            <Button
              variant="outline"
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

  <RelationItemFormDialog
    v-if="itemFormOpen"
    v-model:open="itemFormOpen"
    :media-type="mediaType"
    :initial-data="itemFormInitialData"
    :exclude-game-ids="excludeGameIds"
    :exclude-anime-ids="excludeAnimeIds"
    @submit="handleItemFormSubmit"
  />

  <DeleteConfirmDialog
    v-if="deleteDialogOpen"
    v-model:open="deleteDialogOpen"
    :entity-label="m.library.fields.relatedEntries"
    mode="remove"
    @confirm="deleteId !== null && handleRemove(deleteId)"
  />
</template>
