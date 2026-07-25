<!--
  CompanyTagsItemFormDialog
  Dialog for adding/editing a single tag link.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { nanoid } from 'nanoid'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Form } from '@renderer/components/ui/form'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Field, FieldLabel, FieldContent, FieldGroup } from '@renderer/components/ui/field'
import { TagSelect } from '@renderer/components/shared/tag'
import { db } from '@renderer/core/db'
import { notify } from '@renderer/core/notify'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

interface TagItem {
  id: string
  tagId: string
  tagName: string
  note: string
  isSpoiler: boolean
  orderInCompany: number
  isNew?: boolean
}

interface Props {
  item: TagItem | null
  existingTagIds: string[]
  isAddMode: boolean
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  submit: [item: TagItem]
}>()

// Form state
interface FormData {
  tagId: string
  tagName: string
  note: string
  isSpoiler: boolean
}

const formData = ref<FormData>({
  tagId: '',
  tagName: '',
  note: '',
  isSpoiler: false
})

// Initialize form state when dialog opens
watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      formData.value.tagId = props.item?.tagId ?? ''
      formData.value.tagName = props.item?.tagName ?? ''
      formData.value.note = props.item?.note ?? ''
      formData.value.isSpoiler = props.item?.isSpoiler ?? false
    }
  },
  { immediate: true }
)

const excludeIds = computed(() =>
  props.isAddMode
    ? props.existingTagIds
    : props.existingTagIds.filter((id) => id !== formData.value.tagId)
)

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
    id: props.item?.id || nanoid(),
    tagId: formData.value.tagId,
    tagName: formData.value.tagName,
    note: formData.value.note.trim(),
    isSpoiler: formData.value.isSpoiler,
    orderInCompany: props.item?.orderInCompany ?? 0,
    isNew: props.isAddMode
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
          props.isAddMode ? m.library.forms.addTag : m.library.forms.editTagLink
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
                  :exclude-ids="excludeIds"
                  :placeholder="
                    m.library.select.selectPlaceholder({ label: m.library.entities.tag })
                  "
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>{{ m.library.fields.note }}</FieldLabel>
              <FieldContent>
                <Input
                  v-model="formData.note"
                  :placeholder="m.library.forms.notePlaceholder"
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
