<!--
  CollectionEntitiesFormDialog

  Dialog for editing the members of a collection, one tab per content entity
  type, with a per-member note and manual ordering. Membership is loaded and
  saved through the collection link registry, so every content entity type is
  covered by the same code path.
-->
<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { nanoid } from 'nanoid'
import { Icon } from '@renderer/components/ui/icon'
import {
  deleteCollectionLinks,
  insertCollectionLinks,
  queryCollectionMembers
} from '@renderer/core/db'
import { useAsyncData, useRenderState } from '@renderer/composables'
import { notify } from '@renderer/core/notify'
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
import { SegmentedControl, SegmentedControlItem } from '@renderer/components/ui/segmented-control'
import { DeleteConfirmDialog } from '@renderer/components/ui/delete-confirm-dialog'
import { ListItem, ListItemActions } from '@renderer/components/ui/list-item'
import { getEntityIcon } from '@renderer/utils/format'
import CollectionEntitiesItemFormDialog from './entity-item-form-dialog.vue'
import { type ContentEntityType, CONTENT_ENTITY_TYPES } from '@shared/common'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const log = createLogger('Collection')

interface EntityLink {
  id: string
  entityId: string
  entityName: string
  entityType: ContentEntityType
  note: string
  orderInCollection: number
  isNew?: boolean
}

interface EntityConfig {
  label: string
}

const ENTITY_CONFIG = computed<Record<ContentEntityType, EntityConfig>>(() => ({
  game: { label: m.value.library.entities.game },
  anime: { label: m.value.library.entities.anime },
  comic: { label: m.value.library.entities.comic },
  novel: { label: m.value.library.entities.novel },
  character: { label: m.value.library.entities.character },
  person: { label: m.value.library.entities.person },
  company: { label: m.value.library.entities.company }
}))

interface Props {
  collectionId: string
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

// State
const entityLinks = ref<EntityLink[]>([])
const currentEntityType = ref<ContentEntityType>('game')
const formOpen = ref(false)
const editingItem = ref<EntityLink | null>(null)
const isAddMode = ref(false)
const deleteId = ref<string | null>(null)
const isSaving = ref(false)

// Fetch data
const {
  data: fetchedLinks,
  isLoading,
  error,
  refetch
} = useAsyncData(
  async () => {
    const groups = await Promise.all(
      CONTENT_ENTITY_TYPES.map(async (entityType) => {
        const members = await queryCollectionMembers(entityType, props.collectionId)
        return members.map((member) => ({
          id: member.id,
          entityId: member.entityId,
          entityName: member.entityName ?? '',
          entityType,
          note: member.note ?? '',
          orderInCollection: member.orderInCollection
        }))
      })
    )

    return groups.flat()
  },
  {
    watch: [() => props.collectionId],
    enabled: () => open.value
  }
)
const state = useRenderState(isLoading, error, fetchedLinks)

// Initialize form state when data loads
watch(fetchedLinks, (links) => {
  if (links) {
    entityLinks.value = links
  }
})

// Reset when dialog opens
watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      refetch()
    }
  },
  { immediate: true }
)

// Computed
const currentTypeLinks = computed(() =>
  entityLinks.value
    .filter((l) => l.entityType === currentEntityType.value)
    .sort((a, b) => a.orderInCollection - b.orderInCollection)
)

const existingEntityIds = computed(() => currentTypeLinks.value.map((l) => l.entityId))

const config = computed(() => ENTITY_CONFIG.value[currentEntityType.value])

const entityCounts = computed(() =>
  CONTENT_ENTITY_TYPES.reduce(
    (acc, type) => {
      acc[type] = entityLinks.value.filter((l) => l.entityType === type).length
      return acc
    },
    {} as Record<ContentEntityType, number>
  )
)

const hasAnyItems = computed(() => currentTypeLinks.value.length > 0)

// Handlers
function handleAddClick() {
  editingItem.value = null
  isAddMode.value = true
  formOpen.value = true
}

function handleEditClick(item: EntityLink) {
  editingItem.value = item
  isAddMode.value = false
  formOpen.value = true
}

function handleFormSubmit(data: EntityLink) {
  if (isAddMode.value) {
    const newOrder = currentTypeLinks.value.length
    entityLinks.value = [...entityLinks.value, { ...data, orderInCollection: newOrder }]
  } else {
    entityLinks.value = entityLinks.value.map((l) => (l.id === data.id ? data : l))
  }
  formOpen.value = false
}

function handleDelete() {
  if (deleteId.value) {
    entityLinks.value = entityLinks.value.filter((l) => l.id !== deleteId.value)
    deleteId.value = null
  }
}

function handleMoveUp(index: number) {
  if (index === 0) return
  const typeLinks = [...currentTypeLinks.value]
  ;[typeLinks[index - 1], typeLinks[index]] = [typeLinks[index], typeLinks[index - 1]]
  typeLinks.forEach((link, i) => {
    link.orderInCollection = i
  })
  const otherLinks = entityLinks.value.filter((l) => l.entityType !== currentEntityType.value)
  entityLinks.value = [...otherLinks, ...typeLinks]
}

function handleMoveDown(index: number) {
  if (index >= currentTypeLinks.value.length - 1) return
  const typeLinks = [...currentTypeLinks.value]
  ;[typeLinks[index], typeLinks[index + 1]] = [typeLinks[index + 1], typeLinks[index]]
  typeLinks.forEach((link, i) => {
    link.orderInCollection = i
  })
  const otherLinks = entityLinks.value.filter((l) => l.entityType !== currentEntityType.value)
  entityLinks.value = [...otherLinks, ...typeLinks]
}

async function handleSave() {
  isSaving.value = true
  try {
    // Membership is rewritten wholesale per entity type, which also reindexes
    // the stored order to the order shown in the list.
    for (const entityType of CONTENT_ENTITY_TYPES) {
      await deleteCollectionLinks(entityType, props.collectionId)

      const rows = entityLinks.value
        .filter((link) => link.entityType === entityType)
        .sort((a, b) => a.orderInCollection - b.orderInCollection)
        .map((link, index) => ({
          id: link.isNew ? nanoid() : link.id,
          collectionId: props.collectionId,
          entityId: link.entityId,
          note: link.note || null,
          orderInCollection: index
        }))

      await insertCollectionLinks(entityType, rows)
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

// Delete dialog computed
const deleteDialogOpen = computed({
  get: () => deleteId.value !== null,
  set: (value) => {
    if (!value) deleteId.value = null
  }
})

const formOpenComputed = computed({
  get: () => formOpen.value,
  set: (value) => {
    formOpen.value = value
  }
})

// Computed model for entity type tabs (SegmentedControl returns string | undefined)
const entityTypeModel = computed({
  get: () => currentEntityType.value,
  set: (v: string | undefined) => {
    if (v) currentEntityType.value = v as ContentEntityType
  }
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <!-- Loading state -->
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
          <DialogTitle>{{ m.library.forms.editCollectionEntities }}</DialogTitle>
        </DialogHeader>
        <DialogBody class="overflow-auto max-h-[60vh]">
          <!-- Entity type tabs -->
          <SegmentedControl
            v-model="entityTypeModel"
            class="mb-4"
          >
            <SegmentedControlItem
              v-for="type in CONTENT_ENTITY_TYPES"
              :key="type"
              :value="type"
              class="flex-1 gap-1"
            >
              {{ ENTITY_CONFIG[type].label }}
              <span
                v-if="entityCounts[type] > 0"
                class="text-muted-foreground"
              >
                ({{ entityCounts[type] }})
              </span>
            </SegmentedControlItem>
          </SegmentedControl>

          <!-- Entity list -->
          <div class="space-y-1">
            <StateView
              v-if="!hasAnyItems"
              state="empty"
              :description="m.library.forms.emptyListHint({ label: config.label })"
              class="py-8"
            />
            <ListItem
              v-for="(link, index) in currentTypeLinks"
              :key="link.id"
              :icon="getEntityIcon(link.entityType)"
              :title="link.entityName"
              :description="link.note"
            >
              <template #actions>
                <ListItemActions
                  movable
                  :is-first="index === 0"
                  :is-last="index === currentTypeLinks.length - 1"
                  @move-up="handleMoveUp(index)"
                  @move-down="handleMoveDown(index)"
                  @edit="handleEditClick(link)"
                  @delete="deleteId = link.id"
                />
              </template>
            </ListItem>
          </div>
        </DialogBody>
        <DialogFooter class="flex justify-between">
          <Button
            variant="outline"
            @click="handleAddClick"
          >
            <Icon
              icon="icon-[mdi--plus]"
              class="size-4 mr-1.5"
            />
            {{ m.library.detail.addEntity({ label: config.label }) }}
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
              {{ isSaving ? m.common.saving : m.common.save }}
            </Button>
          </div>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>

  <!-- Delete confirmation -->
  <DeleteConfirmDialog
    v-if="deleteId"
    v-model:open="deleteDialogOpen"
    :entity-label="m.library.forms.itemEntityLabel"
    mode="remove"
    @confirm="handleDelete"
  />

  <!-- Add/Edit form dialog -->
  <CollectionEntitiesItemFormDialog
    v-if="formOpen"
    v-model:open="formOpenComputed"
    :entity-type="currentEntityType"
    :initial-data="editingItem ?? undefined"
    :existing-entity-ids="existingEntityIds"
    :is-add-mode="isAddMode"
    @submit="handleFormSubmit"
  />
</template>
