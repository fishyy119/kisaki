<!--
  CollectionEntitiesItemFormDialog
  Dialog for adding or editing an entity link in a collection.
-->
<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { nanoid } from 'nanoid'
import { notify } from '@renderer/core/notify'
import { queryEntityRow } from '@renderer/core/db'
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
import { Field, FieldLabel, FieldContent, FieldGroup } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { ENTITY_SELECT_SPECS } from '@renderer/components/shared/entity'
import type { ContentEntityType } from '@shared/common'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

interface EntityLink {
  id: string
  entityId: string
  entityName: string
  entityType: ContentEntityType
  note: string
  orderInCollection: number
  isNew?: boolean
}

interface Props {
  entityType: ContentEntityType
  initialData?: EntityLink
  existingEntityIds: string[]
  isAddMode: boolean
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  submit: [data: EntityLink]
}>()

// Form state
type FormData = Pick<EntityLink, 'entityId' | 'entityName' | 'note'>

const formData = ref<FormData>({
  entityId: '',
  entityName: '',
  note: ''
})

// Initialize form when dialog opens
watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      formData.value.entityId = props.initialData?.entityId || ''
      formData.value.entityName = props.initialData?.entityName || ''
      formData.value.note = props.initialData?.note || ''
    }
  },
  { immediate: true }
)

// The link row stores the name it was created with, so a pick resolves it now.
watch(
  () => formData.value.entityId,
  async (id) => {
    if (!id) {
      formData.value.entityName = ''
      return
    }

    const row = await queryEntityRow(props.entityType, id)
    formData.value.entityName = row?.name ?? 'Unknown'
  }
)

function handleSubmit() {
  if (!formData.value.entityId) {
    notify.error(m.value.library.forms.selectEntityRequired({ label: entityLabel.value }))
    return
  }
  emit('submit', {
    id: props.initialData?.id || nanoid(),
    entityId: formData.value.entityId,
    entityName: formData.value.entityName || 'Unknown',
    entityType: props.entityType,
    note: formData.value.note.trim(),
    orderInCollection: props.initialData?.orderInCollection ?? 0,
    isNew: props.isAddMode
  })
  open.value = false
}

const excludeIds = computed(() => {
  if (props.isAddMode) {
    return props.existingEntityIds
  }
  return props.existingEntityIds.filter((id) => id !== props.initialData?.entityId)
})

const entityLabel = computed(() => m.value.library.entities[props.entityType])
const selectSpec = computed(() => ENTITY_SELECT_SPECS[props.entityType])
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>{{
          (props.isAddMode ? m.library.forms.addEntityTitle : m.library.forms.editEntityTitle)({
            label: entityLabel
          })
        }}</DialogTitle>
      </DialogHeader>
      <Form @submit="handleSubmit">
        <DialogBody>
          <FieldGroup>
            <Field>
              <FieldLabel>{{ entityLabel }}</FieldLabel>
              <FieldContent>
                <component
                  :is="selectSpec.component()"
                  v-model="formData.entityId"
                  :exclude-ids="excludeIds"
                  :placeholder="m.library.select.selectPlaceholder({ label: entityLabel })"
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
          </FieldGroup>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            @click="open = false"
          >
            {{ m.common.cancel }}
          </Button>
          <Button type="submit">{{ m.common.save }}</Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
</template>
