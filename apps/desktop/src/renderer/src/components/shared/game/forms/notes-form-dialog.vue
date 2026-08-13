<!--
  GameNotesFormDialog
  Dialog for creating or editing a game note.
-->
<script setup lang="ts">
import { computed, ref, watch, toRef } from 'vue'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { useAsyncData, useInlineAttachments, useStagedImagePick } from '@renderer/composables'
import { db, attachment } from '@renderer/core/db'
import { notify } from '@renderer/core/notify'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { gameNotes } from '@shared/db'
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

const { m } = useI18n()

const log = createLogger('Game')

interface Props {
  gameId: string
  noteId?: string
  nextOrderInGame: number
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

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

const noteIdRef = toRef(props, 'noteId')
const { setBaselineContent, onAttachment, gcOnCancel, gcOnSave } = useInlineAttachments({
  table: gameNotes,
  rowId: computed(() => noteIdRef.value || ''),
  field: 'contentInlineFiles'
})

const didUseInlineAttachments = ref(false)
async function handleInlineAttachment() {
  didUseInlineAttachments.value = true
  return await onAttachment()
}

const {
  data: existingNote,
  isLoading,
  refetch
} = useAsyncData(() => db.query.gameNotes.findFirst({ where: eq(gameNotes.id, props.noteId!) }), {
  watch: [() => props.noteId],
  enabled: () => open.value && isEditMode.value
})

const currentCoverUrl = computed(() => {
  if (!isEditMode.value) return null
  if (cover.mode.value !== 'keep') return null
  if (!existingNote.value?.coverFile) return null
  return getAttachmentUrl('game_notes', existingNote.value.id, existingNote.value.coverFile)
})

const coverClearDisabled = computed(
  () =>
    cover.mode.value === 'clear' || (cover.mode.value === 'keep' && !existingNote.value?.coverFile)
)

watch(existingNote, (note) => {
  if (!note) return
  formData.value.name = note.name
  formData.value.content = note.content || ''
  setBaselineContent(formData.value.content)
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
    await gcOnCancel()
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
      await db
        .update(gameNotes)
        .set({
          name,
          content: content || null,
          updatedAt: new Date()
        })
        .where(eq(gameNotes.id, props.noteId))

      await gcOnSave(content)

      if (cover.mode.value === 'clear') {
        await attachment.clearFile(gameNotes, props.noteId, 'coverFile')
      }
      if (cover.mode.value === 'set' && cover.pickedPath.value) {
        await attachment.setFile(gameNotes, props.noteId, 'coverFile', {
          kind: 'path',
          path: cover.pickedPath.value
        })
      }
    } else {
      const id = nanoid()
      await db.insert(gameNotes).values({
        id,
        gameId: props.gameId,
        name,
        content: content || null,
        orderInGame: props.nextOrderInGame
      })

      if (cover.mode.value === 'set' && cover.pickedPath.value) {
        await attachment.setFile(gameNotes, id, 'coverFile', {
          kind: 'path',
          path: cover.pickedPath.value
        })
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
          <DialogTitle>{{ isEditMode ? m.game.notes.editNote : m.game.notes.newNote }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleSubmit">
          <DialogBody class="space-y-4 max-h-[80vh] overflow-auto">
            <FieldGroup>
              <Field>
                <FieldLabel>{{ m.game.notes.titleLabel }}</FieldLabel>
                <FieldContent>
                  <Input
                    v-model="formData.name"
                    :placeholder="m.game.notes.titlePlaceholder"
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
                <FieldLabel>{{ m.game.notes.contentLabel }}</FieldLabel>
                <FieldContent>
                  <MarkdownEditor
                    v-model="formData.content"
                    :placeholder="m.game.notes.contentPlaceholder"
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
