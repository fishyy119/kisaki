<!--
  MediaNotesTab
  Detail tab listing a media entry's notes with view/edit/reorder/delete.
  The owning surface supplies the notes; writes go through the per-media
  note store keyed by `mediaType`.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { StateView } from '@renderer/components/ui/state-view'
import { DeleteConfirmDialog } from '@renderer/components/ui/delete-confirm-dialog'
import { notify } from '@renderer/core/notify'
import { createLogger } from '@renderer/core/log'
import type { MediaType } from '@shared/entity-types'
import { useI18n } from '@renderer/composables/use-i18n'
import MediaNotesItem from './notes-item.vue'
import MediaNotesViewDialog from './notes-view-dialog.vue'
import MediaNotesFormDialog from './notes-form-dialog.vue'
import { MEDIA_NOTE_STORES, type MediaNoteRow } from './store'

const { m } = useI18n()

const log = createLogger('Library')

interface Props {
  mediaType: MediaType
  entityId: string
  notes: MediaNoteRow[]
}

const props = defineProps<Props>()

const store = computed(() => MEDIA_NOTE_STORES[props.mediaType])

const viewTargetId = ref<string | null>(null)
const editTargetId = ref<string | null>(null)
const editDialogOpen = ref(false)
const deleteTargetId = ref<string | null>(null)
const isReordering = ref(false)
const displayNotes = ref<MediaNoteRow[]>([])
let pendingNotesSnapshot: MediaNoteRow[] | null = null

watch(
  () => props.notes,
  (next) => {
    const snapshot = [...(next ?? [])]
    if (isReordering.value) {
      pendingNotesSnapshot = snapshot
      return
    }
    displayNotes.value = snapshot
  },
  { immediate: true }
)

const hasNotes = computed(() => displayNotes.value.length > 0)

const viewDialogOpen = computed({
  get: () => viewTargetId.value !== null,
  set: (v) => {
    if (!v) viewTargetId.value = null
  }
})

const deleteDialogOpen = computed({
  get: () => deleteTargetId.value !== null,
  set: (v) => {
    if (!v) deleteTargetId.value = null
  }
})

function openCreateDialog() {
  editTargetId.value = null
  editDialogOpen.value = true
}

function openEditDialog(noteId: string) {
  editTargetId.value = noteId
  editDialogOpen.value = true
}

function openViewDialog(noteId: string) {
  viewTargetId.value = noteId
}

function handleViewEdit() {
  if (!viewTargetId.value) return
  const id = viewTargetId.value
  viewTargetId.value = null
  openEditDialog(id)
}

async function handleDelete(noteId: string) {
  try {
    await store.value.remove(noteId)
    notify.success(m.value.library.notes.noteDeleted)
  } catch (error) {
    log.error('Delete note failed:', error)
    notify.error(m.value.feedback.deleteFailed)
  } finally {
    deleteTargetId.value = null
  }
}

async function normalizeOrders(): Promise<void> {
  for (let i = 0; i < displayNotes.value.length; i++) {
    const note = displayNotes.value[i]!
    if (note.order === i) continue
    await store.value.setOrder(note.id, i)
  }
}

async function reorder(noteId: string, direction: -1 | 1) {
  if (isReordering.value) return

  const index = displayNotes.value.findIndex((n) => n.id === noteId)
  if (index === -1) return

  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= displayNotes.value.length) return

  const source = displayNotes.value[index]!
  const neighbor = displayNotes.value[nextIndex]!

  // Optimistic UI swap
  const next = [...displayNotes.value]
  next[index] = neighbor
  next[nextIndex] = source
  displayNotes.value = next

  isReordering.value = true
  try {
    if (source.order === neighbor.order) {
      await normalizeOrders()
      return
    }

    // Swap the two order values (2 updates)
    await store.value.setOrder(source.id, neighbor.order)
    await store.value.setOrder(neighbor.id, source.order)
  } catch (error) {
    log.error('Reorder failed:', error)
    notify.error(m.value.library.notes.reorderFailed)
    displayNotes.value = [...props.notes]
  } finally {
    isReordering.value = false
    if (pendingNotesSnapshot) {
      displayNotes.value = pendingNotesSnapshot
      pendingNotesSnapshot = null
    }
  }
}
</script>

<template>
  <!-- Empty state -->
  <StateView
    v-if="!hasNotes"
    state="empty"
    icon="icon-[mdi--note-text-outline]"
    :title="m.library.notes.emptyTitle"
    :description="m.library.notes.emptyHint"
    class="py-12"
  >
    <template #actions>
      <Button @click="openCreateDialog">
        <Icon
          icon="icon-[mdi--plus]"
          class="size-4 mr-2"
        />
        {{ m.library.notes.newNote }}
      </Button>
    </template>
  </StateView>

  <!-- Notes list -->
  <template v-else>
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Button
            size="sm"
            @click="openCreateDialog"
          >
            <Icon
              icon="icon-[mdi--plus]"
              class="size-4 mr-1.5"
            />
            {{ m.library.notes.newNote }}
          </Button>
          <span class="text-xs text-muted-foreground">{{
            m.values.itemCount({ count: displayNotes.length })
          }}</span>
        </div>
      </div>

      <div class="rounded-md border divide-y overflow-hidden">
        <MediaNotesItem
          v-for="(note, index) in displayNotes"
          :key="note.id"
          :media-type="props.mediaType"
          :note="note"
          :can-move-up="!isReordering && index > 0"
          :can-move-down="!isReordering && index < displayNotes.length - 1"
          @open="openViewDialog(note.id)"
          @move-up="reorder(note.id, -1)"
          @move-down="reorder(note.id, 1)"
          @edit="openEditDialog(note.id)"
          @delete="deleteTargetId = note.id"
        />
      </div>
    </div>
  </template>

  <MediaNotesViewDialog
    v-if="viewTargetId"
    v-model:open="viewDialogOpen"
    :media-type="props.mediaType"
    :note-id="viewTargetId"
    @edit="handleViewEdit"
  />

  <MediaNotesFormDialog
    v-if="editDialogOpen"
    v-model:open="editDialogOpen"
    :media-type="props.mediaType"
    :entity-id="props.entityId"
    :note-id="editTargetId || undefined"
    :next-order="displayNotes.length"
  />

  <DeleteConfirmDialog
    v-if="deleteDialogOpen"
    v-model:open="deleteDialogOpen"
    :entity-label="m.library.notes.entityLabel"
    @confirm="deleteTargetId && handleDelete(deleteTargetId)"
  />
</template>
