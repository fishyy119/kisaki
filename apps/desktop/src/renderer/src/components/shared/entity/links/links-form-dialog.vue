<!--
  EntityLinksFormDialog
  Role-grouped editor for one direction of a cross-entity link table. The
  `view` prop selects the spec that owns the table, role vocabulary and
  target presentation; the dialog itself is fully spec-driven.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { newId } from '@shared/id'
import { Icon } from '@renderer/components/ui/icon'
import { useLiveQuery } from '@renderer/composables'
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
import { notify } from '@renderer/core/notify'
import { ListItem, ListItemActions } from '@renderer/components/ui/list-item'
import { VirtualList } from '@renderer/components/ui/virtual'
import { CoverImage } from '@renderer/components/ui/cover-image'
import { getEntityAttachmentUrl } from '@renderer/utils/entity-image'
import { getEntityIcon, getSpoilerDisplay } from '@renderer/utils/format'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'
import { LINK_VIEW_SPECS, type LinkViewKey, type LinkViewSpec } from './link-specs'
import LinkItemFormDialog from './link-item-form-dialog.vue'

const { m } = useI18n()

const log = createLogger('Library')

interface Props {
  view: LinkViewKey
  entityId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const spec = computed<LinkViewSpec>(() => LINK_VIEW_SPECS[props.view])
const targetLabel = computed(() => m.value.library.entities[spec.value.targetType])
const roleLabels = computed(() => spec.value.roleLabels(m.value))

interface LinkItem {
  id: string
  targetId: string
  targetName: string
  targetImage: string | null
  role: string
  note: string
  isSpoiler: boolean
  order: number
  counterOrder: number
  isNew?: boolean
}

// Form state
const items = ref<LinkItem[]>([])
const editingItem = ref<LinkItem | null>(null)
const isAddMode = ref(false)
const deleteId = ref<string | null>(null)
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

const { data: results, isLoading } = useLiveQuery(() => spec.value.list(props.entityId), {
  watch: [() => props.entityId],
  enabled: () => open.value
})

// Initialize form state when data loads
watch(results, (data) => {
  if (data) {
    items.value = data.map((row, index) => ({
      id: row.id,
      targetId: row.targetId,
      targetName: row.targetName,
      targetImage: row.targetImage,
      role: row.role,
      note: row.note || '',
      isSpoiler: row.isSpoiler,
      order: index,
      counterOrder: row.counterOrder
    }))
  }
})

// Items grouped by role in the spec's role order
const groupedItems = computed(() => {
  const grouped = Object.fromEntries(
    spec.value.roleOrder.map((role) => [role, [] as LinkItem[]])
  ) as Record<string, LinkItem[]>
  items.value.forEach((item) => {
    grouped[item.role]?.push(item)
  })
  for (const role of spec.value.roleOrder) {
    grouped[role]!.sort((a, b) => a.order - b.order)
  }
  return grouped
})

// Existing target IDs for excluding from select
const existingTargetIds = computed(() => items.value.map((item) => item.targetId))

// Pair each link with its spoiler-aware display texts and thumbnail URL
function withSpoiler(links: LinkItem[]) {
  return links.map((link) => ({
    link,
    spoiler: getSpoilerDisplay(link.targetName, link.note, link.isSpoiler, spoilersRevealed.value),
    imageUrl: link.targetImage
      ? getEntityAttachmentUrl(spec.value.targetType, link.targetId, link.targetImage, {
          width: 100,
          height: 100
        })
      : null
  }))
}

// Delete dialog state
const deleteDialogOpen = computed({
  get: () => deleteId.value !== null,
  set: (v) => {
    if (!v) deleteId.value = null
  }
})

// Item form initial data
const itemFormInitialData = computed(() => {
  if (!editingItem.value || isAddMode.value) return undefined
  return {
    targetId: editingItem.value.targetId,
    targetName: editingItem.value.targetName,
    targetImage: editingItem.value.targetImage,
    role: editingItem.value.role,
    note: editingItem.value.note,
    isSpoiler: editingItem.value.isSpoiler
  }
})

async function handleSave() {
  isSaving.value = true
  try {
    const rows: Parameters<typeof spec.value.replace>[1] = []
    for (const role of spec.value.roleOrder) {
      groupedItems.value[role]!.forEach((link, index) => {
        rows.push({
          id: link.isNew ? newId() : link.id,
          targetId: link.targetId,
          role: link.role,
          note: link.note || null,
          isSpoiler: link.isSpoiler,
          order: index,
          counterOrder: link.counterOrder
        })
      })
    }
    await spec.value.replace(props.entityId, rows)

    notify.success(m.value.feedback.saved)
    open.value = false
  } catch (error) {
    log.error('Save failed:', error)
    notify.error(m.value.library.feedback.saveFailedRetry)
  } finally {
    isSaving.value = false
  }
}

function reorderRole(role: string, roleLinks: LinkItem[]) {
  roleLinks.forEach((link, i) => {
    link.order = i
  })
  const otherItems = items.value.filter((item) => item.role !== role)
  items.value = [...otherItems, ...roleLinks]
}

function handleMoveUp(role: string, index: number) {
  if (index <= 0) return
  const roleLinks = [...groupedItems.value[role]!]
  ;[roleLinks[index - 1], roleLinks[index]] = [roleLinks[index]!, roleLinks[index - 1]!]
  reorderRole(role, roleLinks)
}

function handleMoveDown(role: string, index: number) {
  const roleLinks = [...groupedItems.value[role]!]
  if (index >= roleLinks.length - 1) return
  ;[roleLinks[index], roleLinks[index + 1]] = [roleLinks[index + 1]!, roleLinks[index]!]
  reorderRole(role, roleLinks)
}

function handleRemove(id: string) {
  items.value = items.value.filter((item) => item.id !== id)
  deleteId.value = null
}

function handleEdit(item: LinkItem) {
  editingItem.value = { ...item }
  isAddMode.value = false
  itemFormOpen.value = true
}

function handleAddNew() {
  editingItem.value = {
    id: newId(),
    targetId: '',
    targetName: '',
    targetImage: null,
    role: spec.value.roleOrder[0]!,
    note: '',
    isSpoiler: false,
    order: items.value.length,
    counterOrder: 0,
    isNew: true
  }
  isAddMode.value = true
  itemFormOpen.value = true
}

function handleItemFormSubmit(data: {
  targetId: string
  targetName: string
  targetImage: string | null
  role: string
  note: string
  isSpoiler: boolean
}) {
  const updatedItem: LinkItem = {
    id: editingItem.value!.id,
    targetId: data.targetId,
    targetName: data.targetName,
    targetImage: data.targetImage,
    role: data.role,
    note: data.note,
    isSpoiler: data.isSpoiler,
    order: editingItem.value!.order,
    counterOrder: editingItem.value!.counterOrder,
    isNew: editingItem.value!.isNew
  }

  if (isAddMode.value) {
    updatedItem.order = groupedItems.value[updatedItem.role]!.length
    items.value.push(updatedItem)
  } else {
    const index = items.value.findIndex((item) => item.id === updatedItem.id)
    if (index !== -1) {
      if (editingItem.value && editingItem.value.role !== updatedItem.role) {
        updatedItem.order = groupedItems.value[updatedItem.role]!.length
      }
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
    <DialogContent size="md">
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
          <DialogTitle>{{ spec.title(m) }}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div class="space-y-4">
            <StateView
              v-if="items.length === 0"
              state="empty"
              :description="m.library.forms.emptyListHint({ label: targetLabel })"
              class="py-8"
            />
            <template v-else>
              <template
                v-for="role in spec.roleOrder"
                :key="role"
              >
                <div v-if="groupedItems[role]!.length > 0">
                  <h4 class="text-xs font-medium text-muted-foreground mb-2">
                    {{ roleLabels[role] }}
                  </h4>
                  <!-- A role can carry hundreds of links, so rows virtualize -->
                  <VirtualList
                    :items="withSpoiler(groupedItems[role]!)"
                    :get-key="(entry) => entry.link.id"
                    scroll="region"
                    class="flex flex-col gap-1"
                  >
                    <template #item="{ item: { link, spoiler, imageUrl }, index }">
                      <ListItem
                        :icon="
                          spoiler.hidden
                            ? 'icon-[mdi--eye-off-outline]'
                            : getEntityIcon(spec.targetType)
                        "
                        :title="spoiler.name"
                        :description="spoiler.note"
                      >
                        <template
                          v-if="imageUrl && !spoiler.hidden"
                          #leading
                        >
                          <CoverImage
                            :src="imageUrl"
                            :alt="spoiler.name"
                            class="size-10 shrink-0 rounded-md border shadow-raised"
                          />
                        </template>
                        <template
                          v-if="!spoiler.hidden"
                          #actions
                        >
                          <ListItemActions
                            movable
                            :is-first="index === 0"
                            :is-last="index === groupedItems[role]!.length - 1"
                            @move-up="handleMoveUp(role, index)"
                            @move-down="handleMoveDown(role, index)"
                            @edit="handleEdit(link)"
                            @delete="deleteId = link.id"
                          />
                        </template>
                      </ListItem>
                    </template>
                  </VirtualList>
                </div>
              </template>
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
            {{ m.library.detail.addEntity({ label: targetLabel }) }}
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

  <!-- Delete confirmation dialog -->
  <DeleteConfirmDialog
    v-if="deleteDialogOpen"
    v-model:open="deleteDialogOpen"
    :entity-label="m.library.forms.linkLabels[spec.targetType]"
    mode="remove"
    @confirm="deleteId !== null && handleRemove(deleteId)"
  />

  <!-- Link item form dialog -->
  <LinkItemFormDialog
    v-if="itemFormOpen"
    v-model:open="itemFormOpen"
    :view="props.view"
    :initial-data="itemFormInitialData"
    :exclude-ids="existingTargetIds"
    @submit="handleItemFormSubmit"
  />

  <SpoilerConfirmDialog
    v-if="spoilerConfirmOpen"
    v-model:open="spoilerConfirmOpen"
    @confirm="handleRevealSpoilersConfirm"
  />
</template>
