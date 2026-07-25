<!--
  GameTagsItemFormDialog
  Dialog for adding/editing a tag link with spoiler flag and note.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { db } from '@renderer/core/db'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Field, FieldLabel, FieldContent, FieldGroup } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { TagSelect } from '@renderer/components/shared/tag'
import { notify } from '@renderer/core/notify'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

interface TagLinkData {
  tagId: string
  tagName: string
  note: string
  isSpoiler: boolean
}

interface Props {
  initialData?: TagLinkData
  excludeIds: string[]
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  submit: [data: TagLinkData]
}>()

// Form state
const formData = ref<TagLinkData>({
  tagId: '',
  tagName: '',
  note: '',
  isSpoiler: false
})

const isAddMode = computed(() => !props.initialData)

// Initialize form state when dialog opens
watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      if (props.initialData) {
        formData.value.tagId = props.initialData.tagId
        formData.value.tagName = props.initialData.tagName
        formData.value.note = props.initialData.note
        formData.value.isSpoiler = props.initialData.isSpoiler
      } else {
        formData.value.tagId = ''
        formData.value.tagName = ''
        formData.value.note = ''
        formData.value.isSpoiler = false
      }
    }
  },
  { immediate: true }
)

const selectExcludeIds = computed(() => {
  if (isAddMode.value) {
    return props.excludeIds
  }
  return props.excludeIds.filter((id) => id !== formData.value.tagId)
})

// Watch for tag selection change - async side effect to fetch tag name
watch(
  () => formData.value.tagId,
  async (tagId) => {
    if (!tagId) {
      formData.value.tagName = ''
      return
    }
    const tag = await db.query.tags.findFirst({
      where: (t, { eq }) => eq(t.id, tagId)
    })
    if (tag) {
      formData.value.tagName = tag.name
    }
  }
)

function handleSubmit() {
  if (!formData.value.tagId) {
    notify.error(m.value.library.forms.selectTagRequired)
    return
  }

  emit('submit', {
    tagId: formData.value.tagId,
    tagName: formData.value.tagName,
    note: formData.value.note.trim(),
    isSpoiler: formData.value.isSpoiler
  })
  open.value = false
}

function handleCancel() {
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>{{
          isAddMode ? m.library.forms.addTag : m.library.forms.editTagLink
        }}</DialogTitle>
      </DialogHeader>
      <Form @submit="handleSubmit">
        <DialogBody>
          <FieldGroup>
            <Field>
              <FieldLabel>{{ m.library.fields.tags }}</FieldLabel>
              <FieldContent>
                <TagSelect
                  v-model="formData.tagId"
                  :exclude-ids="selectExcludeIds"
                  :placeholder="
                    m.library.select.selectPlaceholder({ label: m.library.entities.tag })
                  "
                  allow-create
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>{{ m.library.fields.note }}</FieldLabel>
              <FieldContent>
                <Input
                  v-model="formData.note"
                  :placeholder="m.library.forms.noteInfoPlaceholder"
                />
              </FieldContent>
            </Field>
            <Field orientation="horizontal">
              <FieldLabel>{{ m.library.forms.includesSpoiler }}</FieldLabel>
              <FieldContent>
                <Checkbox v-model="formData.isSpoiler" />
              </FieldContent>
            </Field>
          </FieldGroup>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            @click="handleCancel"
          >
            {{ m.common.cancel }}
          </Button>
          <Button type="submit">{{ m.common.confirm }}</Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
</template>
