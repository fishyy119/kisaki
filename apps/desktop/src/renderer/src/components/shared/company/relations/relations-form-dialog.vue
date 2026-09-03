<!--
  CompanyRelationsFormDialog
  Dialog for editing the company relations of one company from its own
  perspective, grouped by relation type. Out-edges are owned here and are
  rewritten on save; in-edges (stored on the other endpoint) appear with the
  inverse vocabulary and save back onto their stored row, so a relation stays
  editable from both sides. Only out-edges are orderable: the stored order
  belongs to the from side.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { asc, eq, inArray } from 'drizzle-orm'
import { newId } from '@shared/id'
import { Icon } from '@renderer/components/ui/icon'
import {
  COMPANY_RELATION_TYPES,
  COMPANY_RELATION_TYPE_INVERSE,
  companyRelations,
  type CompanyRelationType,
  type NewCompanyRelation
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
import RelationItemFormDialog, { type CompanyRelationDraft } from './relation-item-form-dialog.vue'

const { m } = useI18n()

const log = createLogger('Library')

interface Props {
  companyId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

interface RelationItem extends CompanyRelationDraft {
  id: string
  direction: 'out' | 'in'
  isNew?: boolean
}

/** Loaded state of an in-edge row, for diffing viewed edits back onto it. */
interface InEdgeSnapshot {
  targetId: string
  type: CompanyRelationType
  note: string
}

const RELATION_TYPE_LABELS = computed<Record<string, string>>(() => m.value.library.companyRelation)

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
        .from(companyRelations)
        .where(eq(companyRelations.fromId, props.companyId))
        .orderBy(asc(companyRelations.orderInFrom), asc(companyRelations.createdAt)),
      db
        .select()
        .from(companyRelations)
        .where(eq(companyRelations.toId, props.companyId))
        .orderBy(asc(companyRelations.createdAt))
    ])

    const targetIds = [...outRows.map((row) => row.toId), ...inRows.map((row) => row.fromId)]
    const nameById = new Map(
      (await queryEntityNames('company', targetIds, true)).map((row) => [row.id, row.name])
    )

    const loadedItems: RelationItem[] = [
      ...outRows.map((row): RelationItem => ({
        id: row.id,
        direction: 'out',
        targetId: row.toId,
        targetName: nameById.get(row.toId) ?? '',
        type: row.type,
        note: row.note ?? ''
      })),
      ...inRows.map((row): RelationItem => ({
        id: row.id,
        direction: 'in',
        targetId: row.fromId,
        targetName: nameById.get(row.fromId) ?? '',
        type: COMPANY_RELATION_TYPE_INVERSE[row.type],
        note: row.note ?? ''
      }))
    ]

    const snapshots = new Map<string, InEdgeSnapshot>(
      loadedItems
        .filter((item) => item.direction === 'in')
        .map((item) => [item.id, { targetId: item.targetId, type: item.type, note: item.note }])
    )

    return { items: loadedItems, snapshots }
  },
  {
    watch: [() => props.companyId],
    enabled: () => open.value
  }
)
const state = useRenderState(isLoading, error, fetchedData)

watch(fetchedData, (data) => {
  items.value = data ? [...data.items] : []
  inSnapshots.value = data ? data.snapshots : new Map()
})

// A company cannot relate to itself, and a pair already listed cannot be added twice.
const excludeIds = computed(() => [props.companyId, ...items.value.map((item) => item.targetId)])

// Out-edges keep list order and prefix each group; in-edges trail unordered.
const groups = computed(() =>
  COMPANY_RELATION_TYPES.map((type) => {
    const ofType = items.value.filter((item) => item.type === type)
    const outs = ofType.filter((item) => item.direction === 'out')
    const ins = ofType.filter((item) => item.direction === 'in')
    return { type, items: [...outs, ...ins], outCount: outs.length }
  }).filter((group) => group.items.length > 0)
)

/** An in-edge whose target changed re-points elsewhere, so it becomes an out-edge here. */
function isRetargetedInEdge(item: RelationItem): boolean {
  if (item.direction !== 'in') return false
  const snapshot = inSnapshots.value.get(item.id)
  if (!snapshot) return true
  return snapshot.targetId !== item.targetId
}

async function handleSave() {
  isSaving.value = true
  try {
    const keptInIds = new Set<string>()
    const inUpdates: { id: string; type: CompanyRelationType; note: string | null }[] = []
    const outValues: NewCompanyRelation[] = []

    let orderInFrom = 0
    for (const group of groups.value) {
      for (const item of group.items) {
        if (item.direction === 'in' && !isRetargetedInEdge(item)) {
          keptInIds.add(item.id)
          const snapshot = inSnapshots.value.get(item.id)!
          if (snapshot.type !== item.type || snapshot.note !== item.note) {
            inUpdates.push({
              id: item.id,
              // The stored row points at this company, so the viewed label
              // writes back through the inverse vocabulary.
              type: COMPANY_RELATION_TYPE_INVERSE[item.type],
              note: item.note || null
            })
          }
          continue
        }

        outValues.push({
          id: item.isNew ? newId() : item.id,
          fromId: props.companyId,
          toId: item.targetId,
          type: item.type,
          note: item.note || null,
          orderInFrom: orderInFrom++
        })
      }
    }

    const removedInIds = [...inSnapshots.value.keys()].filter((id) => !keptInIds.has(id))

    await db.delete(companyRelations).where(eq(companyRelations.fromId, props.companyId))
    if (removedInIds.length > 0) {
      await db.delete(companyRelations).where(inArray(companyRelations.id, removedInIds))
    }
    for (const update of inUpdates) {
      await db
        .update(companyRelations)
        .set({ type: update.type, note: update.note, updatedAt: new Date() })
        .where(eq(companyRelations.id, update.id))
    }
    if (outValues.length > 0) {
      await db.insert(companyRelations).values(outValues)
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

function handleItemFormSubmit(data: CompanyRelationDraft) {
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

function handleMove(type: CompanyRelationType, index: number, offset: -1 | 1) {
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
    <DialogContent size="md">
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
          <DialogTitle>{{ m.library.forms.editCompanyRelations }}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <StateView
            v-if="items.length === 0"
            state="empty"
            :description="
              m.library.forms.emptyListHint({ label: m.library.fields.companyRelations })
            "
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
                  :icon="getEntityIcon('company')"
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
            {{ m.library.detail.addEntity({ label: m.library.fields.companyRelations }) }}
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
    :initial-data="itemFormInitialData"
    :exclude-ids="excludeIds"
    @submit="handleItemFormSubmit"
  />

  <DeleteConfirmDialog
    v-if="deleteDialogOpen"
    v-model:open="deleteDialogOpen"
    :entity-label="m.library.fields.companyRelations"
    mode="remove"
    @confirm="deleteId !== null && handleRemove(deleteId)"
  />
</template>
