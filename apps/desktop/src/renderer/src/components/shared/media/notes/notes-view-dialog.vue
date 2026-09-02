<!--
  MediaNotesViewDialog
  Readonly dialog for viewing a single media note.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useAsyncData, useDbChanges } from '@renderer/composables'
import type { MediaType } from '@shared/entity-types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { StateView } from '@renderer/components/ui/state-view'
import { MarkdownContent } from '@renderer/components/ui/markdown'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { useI18n } from '@renderer/composables/use-i18n'
import { MEDIA_NOTE_STORES } from './store'

const { m } = useI18n()

interface Props {
  mediaType: MediaType
  noteId: string
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  edit: []
}>()

const store = computed(() => MEDIA_NOTE_STORES[props.mediaType])

const { data: note, isLoading } = useAsyncData(() => store.value.find(props.noteId), {
  watch: [() => props.noteId],
  enabled: () => open.value
})

const coverUrl = computed(() => {
  if (!note.value?.coverFile) return null
  return getAttachmentUrl(store.value.tableName, note.value.id, note.value.coverFile)
})

useDbChanges(({ changes }) => {
  const deleted = changes.some(
    (change) =>
      change.operation === 'deleted' &&
      change.table === store.value.tableName &&
      change.id === props.noteId
  )
  if (deleted) open.value = false
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-4xl">
      <template v-if="isLoading">
        <DialogBody>
          <StateView
            state="loading"
            class="py-10"
          />
        </DialogBody>
      </template>

      <template v-else-if="!note">
        <DialogHeader>
          <DialogTitle>{{ m.library.notes.title }}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <StateView
            state="not-found"
            :description="m.library.notes.notFound"
            class="py-10"
          />
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            @click="open = false"
          >
            {{ m.actions.close }}
          </Button>
        </DialogFooter>
      </template>

      <template v-else>
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon
              icon="icon-[mdi--note-text-outline]"
              class="size-4 text-muted-foreground"
            />
            {{ note.name }}
          </DialogTitle>
        </DialogHeader>
        <DialogBody class="max-h-[70vh] overflow-auto space-y-4">
          <div
            v-if="coverUrl"
            class="rounded-lg overflow-hidden border bg-muted"
          >
            <img
              :src="coverUrl"
              alt=""
              class="w-full max-h-[360px] object-contain"
            />
          </div>
          <MarkdownContent
            :content="note.content || ''"
            class="prose-headings:scroll-mt-4"
          />
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            @click="open = false"
          >
            {{ m.actions.close }}
          </Button>
          <Button @click="emit('edit')">{{ m.actions.edit }}</Button>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>
</template>
