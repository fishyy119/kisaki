<!--
  MediaRelationsFormDialog
  Dialog for editing the media relations of one entry from its own
  perspective, grouped by relation type. Out-edges are owned here and are
  rewritten on save; in-edges (stored on the other endpoint) appear with the
  inverse vocabulary and save back onto their stored row, so a relation stays
  editable from both sides. Edges the display reader hides as subsumed are
  hidden here too, so a subsumed out-edge is dropped by the next save.
  Only out-edges are orderable: the stored order belongs to the from side.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { newId } from '@shared/id'
import { Icon } from '@renderer/components/ui/icon'
import { MEDIA_TYPES, type MediaType } from '@shared/entity-types'
import {
  MEDIA_RELATION_TYPES,
  MEDIA_RELATION_TYPE_INVERSE,
  collapseSubsumedMediaRelations,
  mediaRelations,
  type MediaRelationType,
  type NewMediaRelation
} from '@shared/db'
import { db, queryEntityNames } from '@renderer/core/db'
import { useLiveQuery, useRenderState } from '@renderer/composables'
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
  direction: 'out' | 'in'
  isNew?: boolean
}

/** Loaded state of an in-edge row, for diffing viewed edits back onto it. */
interface InEdgeSnapshot {
  targetType: MediaType
  targetId: string
  type: MediaRelationType
  note: string
}

const RELATION_TYPE_LABELS = computed<Record<string, string>>(() => m.value.library.mediaRelation)

// Form state
const items = ref<RelationItem[]>([])
const inSnapshots = ref<Map<string, InEdgeSnapshot>>(new Map())
const editingItem = ref<RelationItem | null>(null)
const isAddMode = ref(false)
const deleteId = ref<string | null>(null)
const isSaving = ref(false)
const itemFormOpen = ref(false)

// Fetch both edge directions when the dialog opens; in-edges arrive labelled
// with the inverse vocabulary, mirroring the display reader.
const {
  data: fetchedData,
  isLoading,
  error
} = useLiveQuery(
  async () => {
    const [outRows, inRows] = await Promise.all([
      db
        .select()
        .from(mediaRelations)
        .where(
          and(
            eq(mediaRelations.fromType, props.mediaType),
            eq(mediaRelations.fromId, props.entityId)
          )
        )
        .orderBy(asc(mediaRelations.orderInFrom), asc(mediaRelations.createdAt)),
      db
        .select()
        .from(mediaRelations)
        .where(
          and(eq(mediaRelations.toType, props.mediaType), eq(mediaRelations.toId, props.entityId))
        )
        .orderBy(asc(mediaRelations.createdAt))
    ])

    const targets = [
      ...outRows.map((row) => ({ mediaType: row.toType, id: row.toId })),
      ...inRows.map((row) => ({ mediaType: row.fromType, id: row.fromId }))
    ]
    // Names resolve one query per media type; NSFW targets keep their name here
    // because the edge is already listed for editing.
    const nameByKey = new Map<string, string>(
      (
        await Promise.all(
          MEDIA_TYPES.map(async (mediaType) => {
            const ids = targets.filter((target) => target.mediaType === mediaType).map((t) => t.id)
            const rows = await queryEntityNames(mediaType, ids, true)
            return rows.map((row) => [`${mediaType}:${row.id}`, row.name] as const)
          })
        )
      ).flat()
    )

    const loadedItems = collapseSubsumedMediaRelations<RelationItem>(
      [
        ...outRows.map((row): RelationItem => ({
          id: row.id,
          direction: 'out',
          targetType: row.toType,
          targetId: row.toId,
          targetName: nameByKey.get(`${row.toType}:${row.toId}`) ?? '',
          type: row.type,
          note: row.note ?? ''
        })),
        ...inRows.map((row): RelationItem => ({
          id: row.id,
          direction: 'in',
          targetType: row.fromType,
          targetId: row.fromId,
          targetName: nameByKey.get(`${row.fromType}:${row.fromId}`) ?? '',
          type: MEDIA_RELATION_TYPE_INVERSE[row.type],
          note: row.note ?? ''
        }))
      ],
      (item) => ({ type: item.type, targetType: item.targetType, targetId: item.targetId })
    )

    const snapshots = new Map<string, InEdgeSnapshot>(
      loadedItems
        .filter((item) => item.direction === 'in')
        .map((item) => [
          item.id,
          {
            targetType: item.targetType,
            targetId: item.targetId,
            type: item.type,
            note: item.note
          }
        ])
    )

    return { items: loadedItems, snapshots }
  },
  {
    watch: [() => props.entityId],
    enabled: () => open.value
  }
)
const state = useRenderState(isLoading, error, fetchedData)

// Initialize form state when data loads.
watch(fetchedData, (data) => {
  items.value = data ? [...data.items] : []
  inSnapshots.value = data ? data.snapshots : new Map()
})

// An entry cannot relate to itself, and a pair already listed cannot be added twice.
const excludeIdsByType = computed<Record<MediaType, string[]>>(
  () =>
    Object.fromEntries(
      MEDIA_TYPES.map((mediaType) => [
        mediaType,
        [
          ...(props.mediaType === mediaType ? [props.entityId] : []),
          ...items.value
            .filter((item) => item.targetType === mediaType)
            .map((item) => item.targetId)
        ]
      ])
    ) as Record<MediaType, string[]>
)

// Out-edges keep list order and prefix each group; in-edges trail unordered.
const groups = computed(() =>
  MEDIA_RELATION_TYPES.map((type) => {
    const ofType = items.value.filter((item) => item.type === type)
    const outs = ofType.filter((item) => item.direction === 'out')
    const ins = ofType.filter((item) => item.direction === 'in')
    return {
      type,
      items: [...outs, ...ins],
      outCount: outs.length
    }
  }).filter((group) => group.items.length > 0)
)

/** An in-edge whose target changed re-points elsewhere, so it becomes an out-edge here. */
function isRetargetedInEdge(item: RelationItem): boolean {
  if (item.direction !== 'in') return false
  const snapshot = inSnapshots.value.get(item.id)
  if (!snapshot) return true
  return snapshot.targetType !== item.targetType || snapshot.targetId !== item.targetId
}

async function handleSave() {
  isSaving.value = true
  try {
    const keptInIds = new Set<string>()
    const inUpdates: { id: string; type: MediaRelationType; note: string | null }[] = []
    const outValues: NewMediaRelation[] = []

    let orderInFrom = 0
    for (const group of groups.value) {
      for (const item of group.items) {
        if (item.direction === 'in' && !isRetargetedInEdge(item)) {
          keptInIds.add(item.id)
          const snapshot = inSnapshots.value.get(item.id)!
          if (snapshot.type !== item.type || snapshot.note !== item.note) {
            inUpdates.push({
              id: item.id,
              // The stored row points at this entity, so the viewed label
              // writes back through the inverse vocabulary.
              type: MEDIA_RELATION_TYPE_INVERSE[item.type],
              note: item.note || null
            })
          }
          continue
        }

        outValues.push({
          id: item.isNew ? newId() : item.id,
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

    // In-edge rows the user removed (or re-pointed) are deleted by id.
    const removedInIds = [...inSnapshots.value.keys()].filter((id) => !keptInIds.has(id))

    await db
      .delete(mediaRelations)
      .where(
        and(eq(mediaRelations.fromType, props.mediaType), eq(mediaRelations.fromId, props.entityId))
      )
    if (removedInIds.length > 0) {
      await db.delete(mediaRelations).where(inArray(mediaRelations.id, removedInIds))
    }
    for (const update of inUpdates) {
      await db
        .update(mediaRelations)
        .set({ type: update.type, note: update.note, updatedAt: new Date() })
        .where(eq(mediaRelations.id, update.id))
    }
    if (outValues.length > 0) {
      await db.insert(mediaRelations).values(outValues)
    }

    notify.success(m.value.feedback.saved)
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
    items.value.push({ ...data, id: newId(), direction: 'out', isNew: true })
    return
  }
  const index = items.value.findIndex((item) => item.id === editingItem.value?.id)
  if (index !== -1) {
    items.value[index] = { ...items.value[index]!, ...data }
  }
}

function handleRemove(id: string) {
  items.value = items.value.filter((item) => item.id !== id)
  deleteId.value = null
}

function handleMove(type: MediaRelationType, index: number, offset: -1 | 1) {
  const group = groups.value.find((candidate) => candidate.type === type)
  if (!group) return
  const swapWith = index + offset
  // Only out-edges are orderable; they occupy the group prefix.
  if (swapWith < 0 || swapWith >= group.outCount) return

  const indexA = items.value.findIndex((item) => item.id === group.items[index]!.id)
  const indexB = items.value.findIndex((item) => item.id === group.items[swapWith]!.id)
  if (indexA === -1 || indexB === -1) return
  ;[items.value[indexA], items.value[indexB]] = [items.value[indexB]!, items.value[indexA]!]
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
        <DialogBody class="max-h-[60vh]">
          <StateView
            v-if="items.length === 0"
            state="empty"
            :description="m.library.forms.emptyListHint({ label: m.library.fields.relatedEntries })"
            class="py-8"
          />
          <div
            v-else
            class="space-y-2"
          >
            <div
              v-for="group in groups"
              :key="group.type"
            >
              <h4 class="text-xs font-medium text-muted-foreground mb-2">
                {{ RELATION_TYPE_LABELS[group.type] }}
              </h4>
              <div class="space-y-1">
                <ListItem
                  v-for="(item, index) in group.items"
                  :key="item.id"
                  :icon="getEntityIcon(item.targetType)"
                  :title="item.targetName"
                  :description="item.note || undefined"
                >
                  <template #actions>
                    <ListItemActions
                      :movable="item.direction === 'out'"
                      :is-first="index === 0"
                      :is-last="index === group.outCount - 1"
                      @move-up="handleMove(group.type, index, -1)"
                      @move-down="handleMove(group.type, index, 1)"
                      @edit="handleEdit(item)"
                      @delete="deleteId = item.id"
                    />
                  </template>
                </ListItem>
              </div>
            </div>
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
              {{ m.actions.cancel }}
            </Button>
            <Button
              :disabled="isSaving"
              @click="handleSave"
            >
              {{ m.actions.save }}
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
    :exclude-ids-by-type="excludeIdsByType"
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
