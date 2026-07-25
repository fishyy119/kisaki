<!--
  CompanySitesItemFormDialog
  Dialog for adding/editing a single related site link.
-->
<script setup lang="ts">
import { ref, watch } from 'vue'
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
import { Field, FieldLabel, FieldContent, FieldGroup } from '@renderer/components/ui/field'
import { notify } from '@renderer/core/notify'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

interface RelatedSite {
  label: string
  url: string
}

interface Props {
  initialData?: RelatedSite
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  submit: [data: RelatedSite]
}>()

// Form state
const formData = ref<RelatedSite>({
  label: '',
  url: ''
})

// Initialize form state when dialog opens
watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      formData.value.label = props.initialData?.label ?? ''
      formData.value.url = props.initialData?.url ?? ''
    }
  },
  { immediate: true }
)

function handleSubmit() {
  const trimmedLabel = formData.value.label.trim()
  const trimmedUrl = formData.value.url.trim()
  if (!trimmedLabel || !trimmedUrl) {
    notify.error(m.value.library.forms.requiredFieldsMissing)
    return
  }
  emit('submit', { label: trimmedLabel, url: trimmedUrl })
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
          props.initialData ? m.library.forms.editLink : m.library.forms.addLink
        }}</DialogTitle>
      </DialogHeader>
      <Form @submit="handleSubmit">
        <DialogBody>
          <FieldGroup>
            <Field>
              <FieldLabel>{{ m.library.fields.name }}</FieldLabel>
              <FieldContent>
                <Input
                  v-model="formData.label"
                  :placeholder="m.library.forms.siteNamePlaceholder"
                  required
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>{{ m.library.forms.siteUrlLabel }}</FieldLabel>
              <FieldContent>
                <Input
                  v-model="formData.url"
                  placeholder="https://..."
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
            {{ m.common.cancel }}
          </Button>
          <Button type="submit">{{ m.common.confirm }}</Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
</template>
