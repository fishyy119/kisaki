<!--
  MediaNotesFormDialog
  Dialog for creating or editing a media note; media differences arrive as
  the `mediaType` registry key only.
-->
<script setup lang="ts">
import { computed, ref, watch, toRef } from 'vue'
import { useAsyncData, useInlineAttachments, useStagedImagePick } from '@renderer/composables'
import { notify } from '@renderer/core/notify'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import type { MediaType } from '@shared/common'
import { animeNotes, gameNotes } from '@shared/db'
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
import { Input } from '@renderer/components/ui/input'
import { StateView } from '@renderer/components/ui/state-view'
import { MarkdownEditor } from '@renderer/components/ui/markdown'
import { Field, FieldLabel, FieldContent, FieldGroup } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { ImagePicker } from '@renderer/components/ui/image-picker'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'
import { MEDIA_NOTE_STORES } from './store'

const { m } = useI18n()

const log = createLogger('Library')

interface Props {
  mediaType: MediaType
  entityId: string
  noteId?: string
  nextOrder: number
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

const store = computed(() => MEDIA_NOTE_STORES[props.mediaType])

const isEditMode = computed(() => !!props.noteId)

interface FormData {
  name: string
  content: string
}

const formData = ref<FormData>({
  name: '',
  content: ''
})
const isSaving = ref(false)
const didSave = ref(false)

const cover = useStagedImagePick()

/** One attachment manager per media table, picked reactively by media type. */
const noteIdRef = toRef(props, 'noteId')
const rowId = computed(() => noteIdRef.value || '')
const INLINE_ATTACHMENTS: Record<MediaType, ReturnType<typeof useInlineAttachments>> = {
  game: useInlineAttachments({ table: gameNotes, rowId, field: 'contentInlineFiles' }),
  anime: useInlineAttachments({ table: animeNotes, rowId, field: 'contentInlineFiles' })
}

const attachments = computed(() => INLINE_ATTACHMENTS[props.mediaType])

const didUseInlineAttachments = ref(false)
async function handleInlineAttachment() {
  didUseInlineAttachments.value = true
  return await attachments.value.onAttachment()
}

const {
  data: existingNote,
  isLoading,
  refetch
} = useAsyncData(() => store.value.find(props.noteId!), {
  watch: [() => props.noteId],
  enabled: () => open.value && isEditMode.value
})

const currentCoverUrl = computed(() => {
  if (!isEditMode.value) return null
  if (cover.mode.value !== 'keep') return null
  if (!existingNote.value?.coverFile) return null
  return getAttachmentUrl(
    store.value.tableName,
    existingNote.value.id,
    existingNote.value.coverFile
  )
})

const coverClearDisabled = computed(
  () =>
    cover.mode.value === 'clear' || (cover.mode.value === 'keep' && !existingNote.value?.coverFile)
)

watch(existingNote, (note) => {
  if (!note) return
  formData.value.name = note.name
  formData.value.content = note.content || ''
  attachments.value.setBaselineContent(formData.value.content)
})

watch(
  () => open.value,
  (isOpen) => {
    if (!isOpen) return

    didSave.value = false
    didUseInlineAttachments.value = false
    cover.reset()

    if (isEditMode.value) {
      refetch()
      return
    }

    formData.value = { name: '', content: '' }
  },
  { immediate: true }
)

watch(open, async (isOpen, wasOpen) => {
  if (isOpen) return
  if (!wasOpen) return
  if (didSave.value) return
  if (!isEditMode.value) return
  if (!didUseInlineAttachments.value) return

  try {
    await attachments.value.gcOnCancel()
  } catch (error) {
    log.warn('Inline attachment cleanup failed:', error)
  }
})

const canSubmit = computed(() => formData.value.name.trim())

async function handleSubmit() {
  if (!canSubmit.value) return
  isSaving.value = true

  try {
    const name = formData.value.name.trim()
    const content = formData.value.content.trim()

    if (isEditMode.value && props.noteId) {
      await store.value.update(props.noteId, { name, content: content || null })

      await attachments.value.gcOnSave(content)

      if (cover.mode.value === 'clear') {
        await store.value.clearCover(props.noteId)
      }
      if (cover.mode.value === 'set' && cover.pickedPath.value) {
        await store.value.setCover(props.noteId, cover.pickedPath.value)
      }
    } else {
      const id = await store.value.create(props.entityId, {
        name,
        content: content || null,
        order: props.nextOrder
      })

      if (cover.mode.value === 'set' && cover.pickedPath.value) {
        await store.value.setCover(id, cover.pickedPath.value)
      }
    }

    didSave.value = true
    notify.success(m.value.common.saved)
    open.value = false
  } catch (error) {
    log.error('Save note failed:', error)
    notify.error(m.value.common.saveFailed)
  } finally {
    isSaving.value = false
  }
}

function handleCancel() {
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-6xl">
      <template v-if="isEditMode && (isLoading || !existingNote)">
        <DialogBody>
          <StateView
            state="loading"
            class="py-10"
          />
        </DialogBody>
      </template>

      <template v-else>
        <DialogHeader>
          <DialogTitle>{{
            isEditMode ? m.library.notes.editNote : m.library.notes.newNote
          }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleSubmit">
          <DialogBody class="space-y-4 max-h-[80vh] overflow-auto">
            <FieldGroup>
              <Field>
                <FieldLabel>{{ m.library.notes.titleLabel }}</FieldLabel>
                <FieldContent>
                  <Input
                    v-model="formData.name"
                    :placeholder="m.library.notes.titlePlaceholder"
                    autofocus
                  />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>{{ m.library.forms.coverLabel }}</FieldLabel>
                <FieldContent>
                  <ImagePicker
                    :image-url="currentCoverUrl"
                    :picked-path="cover.pickedPath.value"
                    :picked-preview-url="cover.previewUrl.value"
                    :pick-label="m.library.forms.pickCover"
                    :clear-disabled="coverClearDisabled"
                    @pick="cover.pick({ title: m.library.forms.pickCover })"
                    @clear="cover.clear()"
                  />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>{{ m.library.notes.contentLabel }}</FieldLabel>
                <FieldContent>
                  <MarkdownEditor
                    v-model="formData.content"
                    :placeholder="m.library.notes.contentPlaceholder"
                    min-height="420px"
                    max-height="420px"
                    :on-attachment="isEditMode ? handleInlineAttachment : undefined"
                  />
                </FieldContent>
              </Field>
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              :disabled="isSaving"
              @click="handleCancel"
            >
              {{ m.common.cancel }}
            </Button>
            <Button
              type="submit"
              :disabled="isSaving || !canSubmit"
            >
              <Icon
                v-if="isSaving"
                icon="icon-[mdi--loading]"
                class="size-4 animate-spin mr-1.5"
              />
              {{ m.common.save }}
            </Button>
          </DialogFooter>
        </Form>
      </template>
    </DialogContent>
  </Dialog>
</template>
