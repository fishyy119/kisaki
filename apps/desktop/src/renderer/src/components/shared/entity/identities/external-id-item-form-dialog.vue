<!--
  EntityExternalIdItemFormDialog
  Dialog for adding/editing an external ID entry.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
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
import { notify } from '@renderer/core/notify'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

interface ExternalIdData {
  source: string
  externalId: string
}

interface Props {
  initialData?: ExternalIdData
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  submit: [data: ExternalIdData]
}>()

const formData = ref<ExternalIdData>({
  source: '',
  externalId: ''
})

const isAddMode = computed(() => !props.initialData)

watch(
  () => open.value,
  (isOpen) => {
    if (!isOpen) return

    if (props.initialData) {
      formData.value.source = props.initialData.source
      formData.value.externalId = props.initialData.externalId
      return
    }

    formData.value.source = ''
    formData.value.externalId = ''
  },
  { immediate: true }
)

function handleSubmit() {
  const source = formData.value.source.trim()
  const externalId = formData.value.externalId.trim()

  if (!source || !externalId) {
    notify.error(m.value.library.forms.externalIdSourceAndIdRequired)
    return
  }

  emit('submit', { source, externalId })
  open.value = false
}

function handleCancel() {
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent size="sm">
      <DialogHeader>
        <DialogTitle>{{
          isAddMode ? m.library.forms.addExternalId : m.library.forms.editExternalId
        }}</DialogTitle>
      </DialogHeader>
      <Form @submit="handleSubmit">
        <DialogBody>
          <FieldGroup>
            <Field>
              <FieldLabel>{{ m.library.forms.externalIdSourceLabel }}</FieldLabel>
              <FieldContent>
                <Input
                  v-model="formData.source"
                  :placeholder="m.library.forms.externalIdSourcePlaceholder"
                  required
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>{{ m.library.forms.externalIdValueLabel }}</FieldLabel>
              <FieldContent>
                <Input
                  v-model="formData.externalId"
                  :placeholder="m.library.forms.externalIdValuePlaceholder"
                  required
                />
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
            {{ m.actions.cancel }}
          </Button>
          <Button type="submit">{{ m.actions.confirm }}</Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
</template>
